package com.church.treasury.receipt;

import com.church.treasury.TestDb;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.church.treasury.audit.AuditService;
import com.church.treasury.deleted.DeletedEntry;
import com.church.treasury.deleted.DeletedService;
import com.church.treasury.receipt.CreateReceiptRequest.LineRequest;
import com.church.treasury.settings.SettingsDto;
import com.church.treasury.settings.SettingsService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AuditAndSettingsTest {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        TestDb.use(r, "audit_settings");
    }

    @Autowired AuditService audit;
    @Autowired SettingsService settings;
    @Autowired DeletedService deleted;
    @Autowired ReceiptService receipts;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void reset() {
        jdbc.update("DELETE FROM audit_log");
        jdbc.update("DELETE FROM receipt_lines");
        jdbc.update("DELETE FROM receipts");
        jdbc.update("DELETE FROM people");
        jdbc.update("DELETE FROM settings");
    }

    private long makeReceipt(int number) {
        return receipts.create(new CreateReceiptRequest(number, LocalDate.of(2026, 10, 3), "Jane Doe",
            List.of(new LineRequest(1L, false, null, "100")))).id();
    }

    @Test
    void settingsHaveDefaultsAndCanBeChanged() {
        assertThat(settings.get().churchName()).isEmpty();
        assertThat(settings.get().currency()).isEqualTo("UGX");
        SettingsDto saved = settings.update(new SettingsDto("  Example   Church ", "Main Road", "A. Treasurer", "ugx", "Thank you"));
        assertThat(saved.churchName()).isEqualTo("Example Church");
        assertThat(saved.currency()).isEqualTo("UGX");
        assertThat(settings.get().treasurerName()).isEqualTo("A. Treasurer");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE entity_type = 'settings'", Integer.class)).isEqualTo(1);
        // saving again overwrites, it does not duplicate
        settings.update(new SettingsDto("Example Church", "", "", "", ""));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM settings WHERE key = 'churchName'", Integer.class)).isEqualTo(1);
        assertThat(settings.get().currency()).isEqualTo("UGX");
    }

    @Test
    void settingsOverHttp() throws Exception {
        mvc.perform(put("/api/settings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"churchName\":\"Example Church\",\"address\":\"\",\"treasurerName\":\"\",\"currency\":\"UGX\",\"receiptFooter\":\"\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.churchName").value("Example Church"));
        mvc.perform(get("/api/settings")).andExpect(jsonPath("$.churchName").value("Example Church"));
    }

    @Test
    void auditLogCanBeSearchedByActionAndText() {
        long id = makeReceipt(1);
        receipts.delete(id, "entered twice");
        assertThat(audit.search(null, null, "DELETE", null)).hasSize(1);
        assertThat(audit.search(null, null, null, "entered twice")).hasSize(1);
        assertThat(audit.search(null, null, null, null).size()).isGreaterThanOrEqualTo(3);
        assertThat(audit.search(null, null, null, "%")).isEmpty();   // % is matched literally
    }

    @Test
    void chainIsValidUntilSomeoneTampersWithTheDatabase() {
        makeReceipt(1);
        makeReceipt(2);
        assertThat(audit.verify().ok()).isTrue();

        jdbc.update("UPDATE audit_log SET new_value = 'changed secretly' WHERE id = (SELECT MIN(id) FROM audit_log WHERE action = 'CREATE' AND entity_type = 'receipt')");
        AuditService.Verification v = audit.verify();
        assertThat(v.ok()).isFalse();
        assertThat(v.brokenAtId()).isNotNull();
    }

    @Test
    void removingAnEntryBreaksTheChain() {
        makeReceipt(1);
        makeReceipt(2);
        jdbc.update("DELETE FROM audit_log WHERE id = (SELECT MIN(id) + 1 FROM audit_log)");
        assertThat(audit.verify().ok()).isFalse();
    }

    @Test
    void deletedListShowsReceiptsWithReasonMostRecentFirst() throws Exception {
        long a = makeReceipt(1);
        long b = makeReceipt(2);
        receipts.delete(a, "first");
        Thread.sleep(5);
        receipts.delete(b, "second");
        List<DeletedEntry> list = deleted.all();
        assertThat(list).hasSize(2);
        assertThat(list.get(0).reason()).isEqualTo("second");
        assertThat(list.get(0).type()).isEqualTo("receipt");
        mvcRestoreWorks(a);
    }

    private void mvcRestoreWorks(long id) {
        receipts.restore(id);
        assertThat(deleted.all()).hasSize(1);
    }

    @Test
    void auditAndDeletedEndpoints() throws Exception {
        long id = makeReceipt(1);
        receipts.delete(id, "mistake");
        mvc.perform(get("/api/audit").param("action", "DELETE")).andExpect(status().isOk()).andExpect(jsonPath("$[0].reason").value("mistake"));
        mvc.perform(get("/api/audit/verify")).andExpect(jsonPath("$.ok").value(true));
        mvc.perform(get("/api/deleted")).andExpect(jsonPath("$[0].type").value("receipt"));
    }
}
