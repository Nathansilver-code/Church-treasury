package com.church.treasury.receipt;

import com.church.treasury.TestDb;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.church.treasury.api.ApiException;
import com.church.treasury.receipt.CreateReceiptRequest.LineRequest;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ReceiptApiTest {

    static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        TestDb.use(r, "receipt_api");
    }

    @Autowired ReceiptService service;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cleanTables() {
        jdbc.update("DELETE FROM audit_log");
        jdbc.update("DELETE FROM receipt_lines");
        jdbc.update("DELETE FROM receipts");
        jdbc.update("DELETE FROM people");
        jdbc.update("DELETE FROM subgroups");
    }

    private static LineRequest item(long id, String amount) {
        return new LineRequest(id, false, null, amount);
    }

    private static CreateReceiptRequest receipt(int number, String name, LineRequest... lines) {
        return new CreateReceiptRequest(number, DAY, name, List.of(lines));
    }

    @Test
    void offeringIsSavedAsTwoLinkedLinesInTheTwoFunds() {
        ReceiptSummary s = service.create(receipt(1, "Jane Doe", new LineRequest(null, true, null, "1001")));
        assertThat(s.totalHundredths()).isEqualTo(100100);

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT i.fund_id AS fund, l.amount_hundredths AS amt, l.split_group AS grp "
                + "FROM receipt_lines l JOIN items i ON i.id = l.item_id ORDER BY i.fund_id");
        assertThat(rows).hasSize(2);
        assertThat(((Number) rows.get(0).get("fund")).longValue()).isEqualTo(1L);
        assertThat(((Number) rows.get(1).get("fund")).longValue()).isEqualTo(2L);
        assertThat(((Number) rows.get(0).get("amt")).longValue()).isEqualTo(50050L);
        assertThat(((Number) rows.get(1).get("amt")).longValue()).isEqualTo(50050L);
        assertThat(rows.get(0).get("grp")).isNotNull().isEqualTo(rows.get(1).get("grp"));
    }

    @Test
    void receiptWithSeveralItemsHasTheRightTotal() {
        ReceiptSummary s = service.create(receipt(1, "Jane Doe", item(1, "50000"), item(7, "1,200.50")));
        assertThat(s.totalHundredths()).isEqualTo(5_000_000 + 120_050);
        assertThat(service.listForDate(DAY)).hasSize(1);
        assertThat(service.listForDate(DAY).get(0).totalHundredths()).isEqualTo(5_120_050);
    }

    @Test
    void duplicateReceiptNumberIsRejected() {
        service.create(receipt(5, "Jane Doe", item(1, "100")));
        assertThatThrownBy(() -> service.create(receipt(5, "John Doe", item(1, "100"))))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT))
            .hasMessageContaining("already used");
    }

    @Test
    void samePersonInDifferentCaseIsReused() {
        service.create(receipt(1, "Jane Doe", item(1, "100")));
        service.create(receipt(2, "  jane   DOE ", item(1, "100")));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM people", Integer.class)).isEqualTo(1);
    }

    @Test
    void subgroupIsRequiredWhenTheItemHasSubgroups() {
        jdbc.update("INSERT INTO subgroups (item_id, name) SELECT id, 'Group A' FROM items WHERE name = 'Lunch'");
        long lunch = jdbc.queryForObject("SELECT id FROM items WHERE name = 'Lunch'", Long.class);
        long group = jdbc.queryForObject("SELECT id FROM subgroups WHERE name = 'Group A'", Long.class);

        assertThatThrownBy(() -> service.create(receipt(1, "Jane Doe", item(lunch, "100"))))
            .hasMessageContaining("sub-group");
        ReceiptSummary ok = service.create(receipt(2, "Jane Doe", new LineRequest(lunch, false, group, "100")));
        assertThat(ok.totalHundredths()).isEqualTo(10_000);
    }

    @Test
    void badAmountsAndItemsAreRejected() {
        assertThatThrownBy(() -> service.create(receipt(1, "Jane Doe", item(1, "0")))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.create(receipt(1, "Jane Doe", item(1, "10.005")))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(receipt(1, "Jane Doe", item(99999, "100")))).isInstanceOf(ApiException.class);
        // the Offerings 50% halves cannot be picked directly
        long half = jdbc.queryForObject("SELECT id FROM items WHERE system_key = 'OFFERING_TRUST'", Long.class);
        assertThatThrownBy(() -> service.create(receipt(1, "Jane Doe", item(half, "100")))).isInstanceOf(ApiException.class);
    }

    @Test
    void nothingIsSavedWhenOneLineIsInvalid() {
        assertThatThrownBy(() -> service.create(receipt(1, "Jane Doe", item(1, "100"), item(7, "abc"))))
            .isInstanceOf(IllegalArgumentException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM receipts", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM people", Integer.class)).isZero();
    }

    @Test
    void nextNumberFollowsTheHighestUsed() throws Exception {
        mvc.perform(get("/api/receipts/next-number")).andExpect(jsonPath("$.number").value(1));
        service.create(receipt(7, "Jane Doe", item(1, "100")));
        mvc.perform(get("/api/receipts/next-number")).andExpect(jsonPath("$.number").value(8));
    }

    @Test
    void nameSuggestionsPutPrefixMatchesFirst() throws Exception {
        service.create(receipt(1, "Anna Maria", item(1, "100")));
        service.create(receipt(2, "Mary Akello", item(1, "100")));
        service.create(receipt(3, "Peter Okello", item(1, "100")));
        mvc.perform(get("/api/people").param("q", "mar"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0]").value("Mary Akello"))
            .andExpect(jsonPath("$[1]").value("Anna Maria"));
        mvc.perform(get("/api/people").param("q", "")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void auditLogIsAHashChain() {
        service.create(receipt(1, "Jane Doe", item(1, "100")));
        service.create(receipt(2, "John Doe", item(1, "100")));
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT hash, prev_hash FROM audit_log ORDER BY id");
        assertThat(rows.size()).isGreaterThanOrEqualTo(4); // 2 people + 2 receipts
        assertThat(rows.get(0).get("prev_hash")).isNull();
        for (int i = 1; i < rows.size(); i++) {
            assertThat(rows.get(i).get("prev_hash")).isEqualTo(rows.get(i - 1).get("hash"));
        }
    }

    @Test
    void invalidRequestsGetAReadableMessage() throws Exception {
        mvc.perform(post("/api/receipts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"receiptNumber\":0,\"date\":\"2026-10-03\",\"personName\":\"Jane\",\"lines\":[]}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void savingOverHttpReturns201AndAppearsInTheDayList() throws Exception {
        String body = "{\"receiptNumber\":3,\"date\":\"2026-10-03\",\"personName\":\"Jane Doe\","
            + "\"lines\":[{\"itemId\":1,\"offering\":false,\"amount\":\"250\"}]}";
        mvc.perform(post("/api/receipts").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.totalHundredths").value(25000));
        mvc.perform(get("/api/receipts").param("date", "2026-10-03"))
            .andExpect(jsonPath("$[0].personName").value("Jane Doe"))
            .andExpect(jsonPath("$[0].receiptNumber").value(3));
    }
}
