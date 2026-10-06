package com.church.treasury.repository;

import com.church.treasury.deleted.DeletedEntry;
import com.church.treasury.money.Money;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database access for everything that was deleted (flagged, never removed). */
@Repository
public class DeletedRepository {

    private final JdbcTemplate jdbc;

    public DeletedRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<DeletedEntry> all() {
        List<DeletedEntry> out = new ArrayList<>();
        out.addAll(jdbc.query(
            "SELECT r.id, r.receipt_number, p.name, r.receipt_date, COALESCE(SUM(l.amount_hundredths), 0), r.deleted_at, r.delete_reason "
                + "FROM receipts r JOIN people p ON p.id = r.person_id "
                + "LEFT JOIN receipt_lines l ON l.receipt_id = r.id AND l.deleted_at IS NULL "
                + "WHERE r.deleted_at IS NOT NULL GROUP BY r.id, r.receipt_number, p.name, r.receipt_date, r.deleted_at, r.delete_reason",
            (rs, n) -> new DeletedEntry("receipt", rs.getLong(1),
                "Receipt " + rs.getInt(2) + ", " + rs.getString(3) + ", " + rs.getString(4) + ", "
                    + Money.ofHundredths(rs.getLong(5)),
                rs.getString(6), rs.getString(7))));
        out.addAll(jdbc.query(
            "SELECT i.id, i.name, f.name, i.deleted_at, i.delete_reason FROM items i JOIN funds f ON f.id = i.fund_id "
                + "WHERE i.deleted_at IS NOT NULL",
            (rs, n) -> new DeletedEntry("item", rs.getLong(1), "Item " + rs.getString(2) + " (" + rs.getString(3) + ")",
                rs.getString(4), rs.getString(5))));
        out.addAll(jdbc.query(
            "SELECT s.id, s.name, i.name, s.deleted_at, s.delete_reason FROM subgroups s JOIN items i ON i.id = s.item_id "
                + "WHERE s.deleted_at IS NOT NULL",
            (rs, n) -> new DeletedEntry("subgroup", rs.getLong(1), "Sub-group " + rs.getString(2) + " under " + rs.getString(3),
                rs.getString(4), rs.getString(5))));
        return out;
    }
}
