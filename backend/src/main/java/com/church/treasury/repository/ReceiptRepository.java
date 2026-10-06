package com.church.treasury.repository;

import com.church.treasury.receipt.ReceiptSummary;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Database access for receipts and their lines. Contains SQL only, no business rules. */
@Repository
public class ReceiptRepository {

    public record Header(long id, int number, String date, long personId, String personName, boolean deleted, String deleteReason) {}

    public record LineRow(long itemId, String itemName, Long subgroupId, String subgroupName, String fundName,
                          long amountHundredths, String splitGroup) {}

    public record Search(LocalDate from, LocalDate to, String text, boolean includeDeleted) {}

    private static final RowMapper<ReceiptSummary> SUMMARY = (rs, i) -> new ReceiptSummary(
        rs.getLong(1), rs.getInt(2), rs.getString(3), rs.getString(4), rs.getLong(5),
        rs.getString(6) != null, rs.getString(7));

    private final JdbcTemplate jdbc;

    public ReceiptRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int nextNumber() {
        return jdbc.queryForObject("SELECT COALESCE(MAX(receipt_number), 0) + 1 FROM receipts", Integer.class);
    }

    /** Is this receipt number used by any receipt other than excludeId (deleted ones count too)? */
    public boolean numberExists(int number, long excludeId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM receipts WHERE receipt_number = ? AND id <> ?",
            Integer.class, number, excludeId);
        return n != null && n > 0;
    }

    public long insertReceipt(int number, String date, long personId, String createdAt) {
        return jdbc.queryForObject(
            "INSERT INTO receipts (receipt_number, receipt_date, person_id, created_at) VALUES (?, ?, ?, ?) RETURNING id",
            Long.class, number, date, personId, createdAt);
    }

    public void updateHeader(long id, int number, String date, long personId) {
        jdbc.update("UPDATE receipts SET receipt_number = ?, receipt_date = ?, person_id = ? WHERE id = ?",
            number, date, personId, id);
    }

    public void insertLine(long receiptId, long itemId, Long subgroupId, long amountHundredths, String splitGroup) {
        jdbc.update(
            "INSERT INTO receipt_lines (receipt_id, item_id, subgroup_id, amount_hundredths, split_group) VALUES (?, ?, ?, ?, ?)",
            receiptId, itemId, subgroupId, amountHundredths, splitGroup);
    }

    /** Lines are never removed: replaced lines are flagged and kept. */
    public void markLinesDeleted(long receiptId, String deletedAt, String reason) {
        jdbc.update("UPDATE receipt_lines SET deleted_at = ?, delete_reason = ? WHERE receipt_id = ? AND deleted_at IS NULL",
            deletedAt, reason, receiptId);
    }

    public void markReceiptDeleted(long id, String deletedAt, String reason) {
        jdbc.update("UPDATE receipts SET deleted_at = ?, delete_reason = ? WHERE id = ?", deletedAt, reason, id);
    }

    public void restoreReceipt(long id) {
        jdbc.update("UPDATE receipts SET deleted_at = NULL, delete_reason = NULL WHERE id = ?", id);
    }

    public Optional<Header> findHeader(long id) {
        return jdbc.query(
            "SELECT r.id, r.receipt_number, r.receipt_date, r.person_id, p.name, r.deleted_at, r.delete_reason "
                + "FROM receipts r JOIN people p ON p.id = r.person_id WHERE r.id = ?",
            (rs, i) -> new Header(rs.getLong(1), rs.getInt(2), rs.getString(3), rs.getLong(4), rs.getString(5),
                rs.getString(6) != null, rs.getString(7)),
            id).stream().findFirst();
    }

    public List<LineRow> findLines(long receiptId) {
        return jdbc.query(
            "SELECT l.item_id, i.name, l.subgroup_id, s.name, f.name, l.amount_hundredths, l.split_group "
                + "FROM receipt_lines l JOIN items i ON i.id = l.item_id JOIN funds f ON f.id = i.fund_id "
                + "LEFT JOIN subgroups s ON s.id = l.subgroup_id "
                + "WHERE l.receipt_id = ? AND l.deleted_at IS NULL ORDER BY l.id",
            (rs, i) -> {
                long sub = rs.getLong(3);
                Long subgroupId = rs.wasNull() ? null : sub;
                return new LineRow(rs.getLong(1), rs.getString(2), subgroupId, rs.getString(4), rs.getString(5),
                    rs.getLong(6), rs.getString(7));
            },
            receiptId);
    }

    /** Receipts filtered by date range and by name or receipt number, newest first. */
    public List<ReceiptSummary> search(Search f) {
        StringBuilder sql = new StringBuilder(
            "SELECT r.id, r.receipt_number, r.receipt_date, p.name, COALESCE(SUM(l.amount_hundredths), 0), "
                + "r.deleted_at, r.delete_reason "
                + "FROM receipts r JOIN people p ON p.id = r.person_id "
                + "LEFT JOIN receipt_lines l ON l.receipt_id = r.id AND l.deleted_at IS NULL WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (!f.includeDeleted()) {
            sql.append(" AND r.deleted_at IS NULL");
        }
        if (f.from() != null) {
            sql.append(" AND r.receipt_date >= ?");
            args.add(f.from().toString());
        }
        if (f.to() != null) {
            sql.append(" AND r.receipt_date <= ?");
            args.add(f.to().toString());
        }
        if (f.text() != null && !f.text().isBlank()) {
            sql.append(" AND (p.name ILIKE ? ESCAPE '\\' OR CAST(r.receipt_number AS TEXT) = ?)");
            args.add("%" + SqlText.escapeLike(f.text().trim()) + "%");
            args.add(f.text().trim());
        }
        sql.append(" GROUP BY r.id, r.receipt_number, r.receipt_date, p.name, r.deleted_at, r.delete_reason "
            + "ORDER BY r.receipt_date DESC, r.receipt_number DESC LIMIT 300");
        return jdbc.query(sql.toString(), SUMMARY, args.toArray());
    }
}
