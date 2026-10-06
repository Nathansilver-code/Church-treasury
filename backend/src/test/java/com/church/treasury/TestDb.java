package com.church.treasury;

import org.springframework.test.context.DynamicPropertyRegistry;

/**
 * Points a test class at its own empty PostgreSQL schema, so test classes never share data.
 * The database is the one in TREASURY_TEST_DB_URL (default: local database "treasury"
 * with user "treasury"). Only schemas named test_* are created and dropped.
 */
public final class TestDb {
    private TestDb() {}

    public static void use(DynamicPropertyRegistry r, String name) {
        r.add("treasury.db.url", () -> env("TREASURY_TEST_DB_URL", "jdbc:postgresql://localhost:5432/treasury"));
        r.add("treasury.db.username", () -> env("TREASURY_TEST_DB_USER", "treasury"));
        r.add("treasury.db.password", () -> env("TREASURY_TEST_DB_PASSWORD", "treasury"));
        r.add("treasury.db.schema", () -> "test_" + name);
        r.add("treasury.db.fresh-schema", () -> "true");
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return v == null || v.isBlank() ? fallback : v;
    }
}
