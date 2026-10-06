package com.church.treasury.db;

import com.church.treasury.TestDb;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class DatabaseSetupTest {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        TestDb.use(r, "setup");
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cleanTables() {
        // each test starts with no receipts, so the tests do not depend on the order they run in
        jdbc.update("DELETE FROM receipt_lines");
        jdbc.update("DELETE FROM receipts");
        jdbc.update("DELETE FROM people");
    }

    @Test
    void createsSchemaAndSeedsFundsAndItems() throws Exception {
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.funds").value(2))
            .andExpect(jsonPath("$.items").value(20));
    }

    @Test
    void trustFundHasSixItemsAndLocalFundHasFourteen() {
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM items WHERE fund_id = 1", Integer.class)).isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM items WHERE fund_id = 2", Integer.class)).isEqualTo(14);
    }

    private long newReceipt(int number) {
        long person = jdbc.queryForObject("INSERT INTO people (name) VALUES ('Test Person') RETURNING id", Long.class);
        return jdbc.queryForObject(
            "INSERT INTO receipts (receipt_number, receipt_date, person_id, created_at) VALUES (?, '2026-10-03', ?, 'x') RETURNING id",
            Long.class, number, person);
    }

    @Test
    void refusesZeroOrNegativeAmounts() {
        long receipt = newReceipt(1);
        assertThatThrownBy(() -> jdbc.update(
            "INSERT INTO receipt_lines (receipt_id, item_id, amount_hundredths) VALUES (?, 1, 0)", receipt))
            .isInstanceOf(Exception.class);
        assertThatThrownBy(() -> jdbc.update(
            "INSERT INTO receipt_lines (receipt_id, item_id, amount_hundredths) VALUES (?, 1, -5)", receipt))
            .isInstanceOf(Exception.class);
    }

    @Test
    void enforcesForeignKeys() {
        assertThatThrownBy(() -> jdbc.update(
            "INSERT INTO receipts (receipt_number, receipt_date, person_id, created_at) VALUES (99, '2026-10-03', 12345, 'x')"))
            .isInstanceOf(Exception.class);
    }

    @Test
    void receiptNumbersAreUnique() {
        newReceipt(500);
        assertThatThrownBy(() -> newReceipt(500)).isInstanceOf(Exception.class);
    }
}
