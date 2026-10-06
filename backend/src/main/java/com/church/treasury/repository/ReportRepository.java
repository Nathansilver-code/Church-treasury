package com.church.treasury.repository;

import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database access for reports. Deleted receipts and replaced or deleted lines are never counted. */
@Repository
public class ReportRepository {

    public record SummaryRow(long fundId, String fundName, long itemId, String itemName, Long subgroupId,
                             String subgroupName, long total) {}

    public record PersonLine(long receiptId, int receiptNumber, String date, long itemId, String itemName,
                             Long subgroupId, String subgroupName, String fundName, String splitGroup, long amount) {}

    private final JdbcTemplate jdbc;

    public ReportRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<SummaryRow> summaryRows(LocalDate from, LocalDate to) {
        return jdbc.query(
            "SELECT f.id, f.name, i.id, i.name, s.id, s.name, SUM(l.amount_hundredths) "
                + "FROM receipt_lines l "
                + "JOIN receipts r ON r.id = l.receipt_id AND r.deleted_at IS NULL "
                + "JOIN items i ON i.id = l.item_id JOIN funds f ON f.id = i.fund_id "
                + "LEFT JOIN subgroups s ON s.id = l.subgroup_id "
                + "WHERE l.deleted_at IS NULL AND r.receipt_date >= ? AND r.receipt_date <= ? "
                + "GROUP BY f.id, f.name, i.id, i.name, s.id, s.name "
                + "ORDER BY f.id, i.id, lower(s.name)",
            (rs, n) -> {
                long sg = rs.getLong(5);
                Long subgroupId = rs.wasNull() ? null : sg;
                return new SummaryRow(rs.getLong(1), rs.getString(2), rs.getLong(3), rs.getString(4), subgroupId,
                    rs.getString(6), rs.getLong(7));
            },
            from.toString(), to.toString());
    }

    public int receiptCount(LocalDate from, LocalDate to) {
        Integer n = jdbc.queryForObject(
            "SELECT COUNT(*) FROM receipts WHERE deleted_at IS NULL AND receipt_date >= ? AND receipt_date <= ?",
            Integer.class, from.toString(), to.toString());
        return n == null ? 0 : n;
    }

    public List<PersonLine> personLines(long personId, LocalDate from, LocalDate to) {
        return jdbc.query(
            "SELECT r.id, r.receipt_number, r.receipt_date, i.id, i.name, s.id, s.name, f.name, l.split_group, l.amount_hundredths "
                + "FROM receipts r JOIN receipt_lines l ON l.receipt_id = r.id AND l.deleted_at IS NULL "
                + "JOIN items i ON i.id = l.item_id JOIN funds f ON f.id = i.fund_id "
                + "LEFT JOIN subgroups s ON s.id = l.subgroup_id "
                + "WHERE r.deleted_at IS NULL AND r.person_id = ? AND r.receipt_date >= ? AND r.receipt_date <= ? "
                + "ORDER BY r.receipt_date, r.receipt_number, l.id",
            (rs, n) -> {
                long sg = rs.getLong(6);
                Long subgroupId = rs.wasNull() ? null : sg;
                return new PersonLine(rs.getLong(1), rs.getInt(2), rs.getString(3), rs.getLong(4), rs.getString(5),
                    subgroupId, rs.getString(7), rs.getString(8), rs.getString(9), rs.getLong(10));
            },
            personId, from.toString(), to.toString());
    }
}
