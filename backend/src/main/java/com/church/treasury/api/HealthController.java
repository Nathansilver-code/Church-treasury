package com.church.treasury.api;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lets the app (and tests) check that the backend and database are up. */
@RestController
@RequestMapping("/api")
public class HealthController {

    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "ok",
            "funds", jdbc.queryForObject("SELECT COUNT(*) FROM funds", Integer.class),
            "items", jdbc.queryForObject("SELECT COUNT(*) FROM items", Integer.class));
    }
}
