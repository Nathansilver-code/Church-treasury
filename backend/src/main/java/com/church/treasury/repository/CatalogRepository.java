package com.church.treasury.repository;

import com.church.treasury.catalog.CatalogDto.FundDto;
import com.church.treasury.catalog.CatalogDto.ItemDto;
import com.church.treasury.catalog.CatalogDto.SubGroupDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

/** Database access for funds, items and sub-groups. */
@Repository
public class CatalogRepository {

    private final JdbcTemplate jdbc;

    public CatalogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<FundDto> funds() {
        return jdbc.query("SELECT id, name FROM funds ORDER BY id", (rs, i) -> new FundDto(rs.getLong(1), rs.getString(2)));
    }

    public List<ItemDto> activeItemsWithSubgroups() {
        Map<Long, List<SubGroupDto>> subs = new HashMap<>();
        jdbc.query("SELECT id, item_id, name FROM subgroups WHERE deleted_at IS NULL AND active = 1 ORDER BY name",
            (RowCallbackHandler) rs -> subs
                .computeIfAbsent(rs.getLong("item_id"), k -> new ArrayList<>())
                .add(new SubGroupDto(rs.getLong("id"), rs.getString("name"))));
        return jdbc.query(
            "SELECT id, fund_id, name, system_key FROM items WHERE deleted_at IS NULL AND active = 1 ORDER BY id",
            (rs, i) -> new ItemDto(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4),
                subs.getOrDefault(rs.getLong(1), List.of())));
    }

    /** True for an active, non-deleted item that can be picked on a receipt (not an Offering half). */
    public boolean isPickableItem(long itemId) {
        return count("SELECT COUNT(*) FROM items WHERE id = ? AND active = 1 AND deleted_at IS NULL AND system_key IS NULL", itemId) > 0;
    }

    public int activeSubgroupCount(long itemId) {
        return count("SELECT COUNT(*) FROM subgroups WHERE item_id = ? AND active = 1 AND deleted_at IS NULL", itemId);
    }

    public boolean subgroupBelongsToItem(long subgroupId, long itemId) {
        return count("SELECT COUNT(*) FROM subgroups WHERE id = ? AND item_id = ? AND active = 1 AND deleted_at IS NULL",
            subgroupId, itemId) > 0;
    }

    public long systemItemId(String systemKey) {
        return jdbc.queryForObject("SELECT id FROM items WHERE system_key = ?", Long.class, systemKey);
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }
}
