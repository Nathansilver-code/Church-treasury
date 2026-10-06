package com.church.treasury.repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database access for the audit_log table. */
@Repository
public class AuditRepository {

    public record Entry(long id, String ts, String action, String entityType, Long entityId, String oldValue,
                        String newValue, String reason) {}

    /** A stored entry with its hashes, used to check the chain. */
    public record Stored(Entry entry, String prevHash, String hash) {}

    private final JdbcTemplate jdbc;

    public AuditRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String lastHash() {
        return jdbc.query("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1", rs -> rs.next() ? rs.getString(1) : null);
    }

    public void insert(String ts, String action, String entityType, Long entityId, String oldValue,
                       String newValue, String reason, String prevHash, String hash) {
        jdbc.update(
            "INSERT INTO audit_log (ts, action, entity_type, entity_id, old_value, new_value, reason, prev_hash, hash) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ts, action, entityType, entityId, oldValue, newValue, reason, prevHash, hash);
    }

    public List<Entry> search(LocalDate from, LocalDate to, String action, String text, int limit) {
        StringBuilder sql = new StringBuilder(
            "SELECT id, ts, action, entity_type, entity_id, old_value, new_value, reason FROM audit_log WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (from != null) {
            sql.append(" AND ts >= ?");
            args.add(from.toString());
        }
        if (to != null) {
            sql.append(" AND ts < ?");
            args.add(to.plusDays(1).toString());
        }
        if (action != null && !action.isBlank()) {
            sql.append(" AND action = ?");
            args.add(action.trim());
        }
        if (text != null && !text.isBlank()) {
            String like = "%" + SqlText.escapeLike(text.trim()) + "%";
            sql.append(" AND (entity_type ILIKE ? ESCAPE '\\' OR old_value ILIKE ? ESCAPE '\\' OR new_value ILIKE ? ESCAPE '\\' OR reason ILIKE ? ESCAPE '\\')");
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY id DESC LIMIT ").append(limit);
        return jdbc.query(sql.toString(), (rs, n) -> mapEntry(rs), args.toArray());
    }

    public List<Stored> allInOrder() {
        return jdbc.query(
            "SELECT id, ts, action, entity_type, entity_id, old_value, new_value, reason, prev_hash, hash FROM audit_log ORDER BY id",
            (rs, n) -> new Stored(mapEntry(rs), rs.getString(9), rs.getString(10)));
    }

    private static Entry mapEntry(java.sql.ResultSet rs) throws java.sql.SQLException {
        long entityId = rs.getLong(5);
        Long id = rs.wasNull() ? null : entityId;
        return new Entry(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), id,
            rs.getString(6), rs.getString(7), rs.getString(8));
    }
}
