package com.church.treasury.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database access for the people table. */
@Repository
public class PersonRepository {

    private final JdbcTemplate jdbc;

    public PersonRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Long> findIdByName(String name) {
        return jdbc.queryForList(
            "SELECT id FROM people WHERE deleted_at IS NULL AND lower(name) = lower(?) LIMIT 1", Long.class, name)
            .stream().findFirst();
    }

    public long insert(String name) {
        return jdbc.queryForObject("INSERT INTO people (name) VALUES (?) RETURNING id", Long.class, name);
    }

    /** Names containing the text, those starting with it first. Patterns must already be escaped. */
    public List<String> search(String containsPattern, String prefixPattern) {
        return jdbc.queryForList(
            "SELECT name FROM people WHERE deleted_at IS NULL AND name ILIKE ? ESCAPE '\\' "
                + "ORDER BY CASE WHEN name ILIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, lower(name) LIMIT 8",
            String.class, containsPattern, prefixPattern);
    }
}
