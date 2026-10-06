package com.church.treasury.receipt;

import com.church.treasury.TestDb;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.church.treasury.api.ApiException;
import com.church.treasury.receipt.CreateReceiptRequest.LineRequest;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ReceiptManagementTest {

    static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        TestDb.use(r, "receipt_mgmt");
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

    private static CreateReceiptRequest receipt(int number, LocalDate date, String name, LineRequest... lines) {
        return new CreateReceiptRequest(number, date, name, List.of(lines));
    }

    @Test
    void detailShowsAnOfferingAsOneLineWithTheFullAmount() {
        ReceiptSummary s = service.create(receipt(1, DAY, "Jane Doe", item(1, "500"), new LineRequest(null, true, null, "1001")));
        ReceiptDetail d = service.detail(s.id());
        assertThat(d.lines()).hasSize(2);
        assertThat(d.lines().get(1).offering()).isTrue();
        assertThat(d.lines().get(1).amountHundredths()).isEqualTo(100100);
        assertThat(d.totalHundredths()).isEqualTo(50000 + 100100);
    }

    @Test
    void editingChangesNumberDateNameAndItemsAndKeepsTheOldLines() {
        ReceiptSummary s = service.create(receipt(1, DAY, "Jane Doe", item(1, "100")));
        ReceiptDetail after = service.update(s.id(), receipt(2, DAY.plusDays(1), "John Okello", item(7, "50")));

        assertThat(after.receiptNumber()).isEqualTo(2);
        assertThat(after.date()).isEqualTo("2026-10-04");
        assertThat(after.personName()).isEqualTo("John Okello");
        assertThat(after.totalHundredths()).isEqualTo(5000);
        // the replaced line is still in the database, flagged
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM receipt_lines WHERE deleted_at IS NOT NULL", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE action = 'UPDATE'", Integer.class)).isEqualTo(1);
    }

    @Test
    void editingCannotTakeAnotherReceiptsNumber() {
        service.create(receipt(1, DAY, "Jane Doe", item(1, "100")));
        ReceiptSummary second = service.create(receipt(2, DAY, "John Doe", item(1, "100")));
        assertThatThrownBy(() -> service.update(second.id(), receipt(1, DAY, "John Doe", item(1, "100"))))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT));
        // keeping its own number is fine
        assertThat(service.update(second.id(), receipt(2, DAY, "John Doe", item(1, "200"))).totalHundredths()).isEqualTo(20000);
    }

    @Test
    void deleteHidesTheReceiptButKeepsEverythingAndTheNumber() {
        ReceiptSummary s = service.create(receipt(5, DAY, "Jane Doe", item(1, "100")));
        assertThatThrownBy(() -> service.delete(s.id(), "  ")).isInstanceOf(ApiException.class);

        ReceiptDetail gone = service.delete(s.id(), "entered twice");
        assertThat(gone.deleted()).isTrue();
        assertThat(gone.deleteReason()).isEqualTo("entered twice");

        assertThat(service.listForDate(DAY)).isEmpty();
        List<ReceiptSummary> all = service.search(null, null, null, true);
        assertThat(all).hasSize(1);
        assertThat(all.get(0).deleted()).isTrue();
        assertThat(all.get(0).totalHundredths()).isEqualTo(10000);   // the data is still there

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM receipts", Integer.class)).isEqualTo(1);
        assertThat(service.nextNumber()).isEqualTo(6);
        assertThatThrownBy(() -> service.create(receipt(5, DAY, "John Doe", item(1, "100"))))
            .hasMessageContaining("already used");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE action = 'DELETE' AND reason = 'entered twice'", Integer.class)).isEqualTo(1);
    }

    @Test
    void restoreBringsTheReceiptBack() {
        ReceiptSummary s = service.create(receipt(1, DAY, "Jane Doe", item(1, "100")));
        assertThatThrownBy(() -> service.restore(s.id())).isInstanceOf(ApiException.class);   // not deleted yet
        service.delete(s.id(), "mistake");
        ReceiptDetail back = service.restore(s.id());
        assertThat(back.deleted()).isFalse();
        assertThat(service.listForDate(DAY)).hasSize(1);
    }

    @Test
    void aDeletedReceiptCannotBeEditedOrDeletedAgain() {
        ReceiptSummary s = service.create(receipt(1, DAY, "Jane Doe", item(1, "100")));
        service.delete(s.id(), "mistake");
        assertThatThrownBy(() -> service.update(s.id(), receipt(1, DAY, "Jane Doe", item(1, "100"))))
            .hasMessageContaining("Restore");
        assertThatThrownBy(() -> service.delete(s.id(), "again")).isInstanceOf(ApiException.class);
    }

    @Test
    void searchFiltersByDateRangeNameAndNumber() {
        service.create(receipt(10, LocalDate.of(2026, 9, 5), "Anna Maria", item(1, "100")));
        service.create(receipt(11, LocalDate.of(2026, 9, 12), "Mary Akello", item(1, "200")));
        service.create(receipt(12, LocalDate.of(2026, 10, 3), "Peter Okello", item(1, "300")));

        assertThat(service.search(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), null, false)).hasSize(2);
        assertThat(service.search(null, null, "ello", false)).extracting(ReceiptSummary::personName)
            .containsExactlyInAnyOrder("Mary Akello", "Peter Okello");
        assertThat(service.search(null, null, "12", false)).extracting(ReceiptSummary::receiptNumber).containsExactly(12);
        // newest first
        assertThat(service.search(null, null, null, false)).extracting(ReceiptSummary::receiptNumber).containsExactly(12, 11, 10);
        // typed % is matched literally, not as a wildcard
        assertThat(service.search(null, null, "%", false)).isEmpty();
    }

    @Test
    void httpEndpointsEditDeleteAndRestore() throws Exception {
        ReceiptSummary s = service.create(receipt(1, DAY, "Jane Doe", item(1, "100")));
        mvc.perform(get("/api/receipts/" + s.id()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.personName").value("Jane Doe"));
        mvc.perform(delete("/api/receipts/" + s.id()).param("reason", "entered twice"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted").value(true));
        mvc.perform(delete("/api/receipts/" + s.id())).andExpect(status().isBadRequest());
        mvc.perform(post("/api/receipts/" + s.id() + "/restore"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted").value(false));
        mvc.perform(get("/api/receipts/999999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Receipt not found."));
        mvc.perform(get("/api/receipts/search").param("q", "jane"))
            .andExpect(jsonPath("$[0].receiptNumber").value(1));
    }
}
