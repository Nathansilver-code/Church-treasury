package com.church.treasury.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database access for managing items and sub-groups (the Items and sub-groups tab). */
@Repository
public class ItemRepository {

    public record ItemRow(long id, long fundId, String name, String systemKey, boolean used) {}
    public record SubRow(long id, long itemId, String name, boolean used) {}
    public record ItemHeader(long id, long fundId, String name, String systemKey, boolean deleted) {}
    public record SubHeader(long id, long itemId, String name, boolean deleted) {}

    private final JdbcTemplate jdbc;

    public ItemRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ItemRow> visibleItems() {
        return jdbc.query(
            "SELECT i.id, i.fund_id, i.name, i.system_key, "
                + "EXISTS (SELECT 1 FROM receipt_lines l WHERE l.item_id = i.id) "
                + "FROM items i WHERE i.deleted_at IS NULL ORDER BY i.id",
            (rs, n) -> new ItemRow(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getBoolean(5)));
    }

    public List<SubRow> visibleSubgroups() {
        return jdbc.query(
            "SELECT s.id, s.item_id, s.name, "
                + "EXISTS (SELECT 1 FROM receipt_lines l WHERE l.subgroup_id = s.id) "
                + "FROM subgroups s WHERE s.deleted_at IS NULL ORDER BY lower(s.name)",
            (rs, n) -> new SubRow(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getBoolean(4)));
    }

    public boolean fundExists(long fundId) {
        return count("SELECT COUNT(*) FROM funds WHERE id = ?", fundId) > 0;
    }

    public Optional<ItemHeader> findItem(long id) {
        return jdbc.query("SELECT id, fund_id, name, system_key, deleted_at FROM items WHERE id = ?",
            (rs, n) -> new ItemHeader(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getString(5) != null),
            id).stream().findFirst();
    }

    /** Names are unique across all items, deleted ones included, ignoring upper/lower case. */
    public boolean itemNameTaken(String name, long excludeId) {
        return count("SELECT COUNT(*) FROM items WHERE lower(name) = lower(?) AND id <> ?", name, excludeId) > 0;
    }

    public boolean itemUsed(long id) {
        return count("SELECT COUNT(*) FROM receipt_lines WHERE item_id = ?", id) > 0;
    }

    public long insertItem(long fundId, String name) {
        return jdbc.queryForObject("INSERT INTO items (fund_id, name) VALUES (?, ?) RETURNING id", Long.class, fundId, name);
    }

    public void updateItem(long id, long fundId, String name) {
        jdbc.update("UPDATE items SET fund_id = ?, name = ? WHERE id = ?", fundId, name, id);
    }

    public void markItemDeleted(long id, String at, String reason) {
        jdbc.update("UPDATE items SET deleted_at = ?, delete_reason = ? WHERE id = ?", at, reason, id);
    }

    public void restoreItem(long id) {
        jdbc.update("UPDATE items SET deleted_at = NULL, delete_reason = NULL WHERE id = ?", id);
    }

    public Optional<SubHeader> findSub(long id) {
        return jdbc.query("SELECT id, item_id, name, deleted_at FROM subgroups WHERE id = ?",
            (rs, n) -> new SubHeader(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4) != null),
            id).stream().findFirst();
    }

    public boolean subNameTaken(long itemId, String name, long excludeId) {
        return count("SELECT COUNT(*) FROM subgroups WHERE item_id = ? AND lower(name) = lower(?) AND id <> ?",
            itemId, name, excludeId) > 0;
    }

    public long insertSub(long itemId, String name) {
        return jdbc.queryForObject("INSERT INTO subgroups (item_id, name) VALUES (?, ?) RETURNING id", Long.class, itemId, name);
    }

    public void updateSub(long id, String name) {
        jdbc.update("UPDATE subgroups SET name = ? WHERE id = ?", name, id);
    }

    public void markSubDeleted(long id, String at, String reason) {
        jdbc.update("UPDATE subgroups SET deleted_at = ?, delete_reason = ? WHERE id = ?", at, reason, id);
    }

    public void restoreSub(long id) {
        jdbc.update("UPDATE subgroups SET deleted_at = NULL, delete_reason = NULL WHERE id = ?", id);
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }
}
