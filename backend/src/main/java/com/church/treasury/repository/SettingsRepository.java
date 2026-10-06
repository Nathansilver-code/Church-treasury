package com.church.treasury.repository;

import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

/** Database access for the settings table (simple key and value pairs). */
@Repository
public class SettingsRepository {

    private final JdbcTemplate jdbc;

    public SettingsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, String> all() {
        Map<String, String> out = new HashMap<>();
        jdbc.query("SELECT key, value FROM settings",
            (RowCallbackHandler) rs -> out.put(rs.getString(1), rs.getString(2)));
        return out;
    }

    public void put(String key, String value) {
        jdbc.update("INSERT INTO settings (key, value) VALUES (?, ?) "
            + "ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
    }
}
