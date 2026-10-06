package com.church.treasury.report;

import com.church.treasury.TestDb;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.church.treasury.api.ApiException;
import com.church.treasury.item.ItemAdminService;
import com.church.treasury.receipt.CreateReceiptRequest;
import com.church.treasury.receipt.CreateReceiptRequest.LineRequest;
import com.church.treasury.receipt.ReceiptService;
import com.church.treasury.report.SummaryReport.FundTotal;
import java.time.LocalDate;
import java.util.List;
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

/** Uses a small "golden" set of receipts whose totals were worked out by hand. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ReportServiceTest {

    static final LocalDate SAB1 = LocalDate.of(2026, 10, 3);
    static final LocalDate SAB2 = LocalDate.of(2026, 10, 10);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        TestDb.use(r, "reports");
    }

    @Autowired ReportService reports;
    @Autowired ReceiptService receipts;
    @Autowired ItemAdminService items;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    long tithe, camp, lunch;
    long groupA, groupB;

    @BeforeEach
    void goldenData() {
        jdbc.update("DELETE FROM audit_log");
        jdbc.update("DELETE FROM receipt_lines");
        jdbc.update("DELETE FROM receipts");
        jdbc.update("DELETE FROM people");
        jdbc.update("DELETE FROM subgroups");
        tithe = id("Tithe");
        camp = id("Camp Expense");
        lunch = id("Lunch");
        items.createSub(lunch, "Group A");
        items.createSub(lunch, "Group B");
        groupA = jdbc.queryForObject("SELECT id FROM subgroups WHERE name = 'Group A'", Long.class);
        groupB = jdbc.queryForObject("SELECT id FROM subgroups WHERE name = 'Group B'", Long.class);

        // Sabbath 1: Jane: tithe 500, offering 1,001 (500.50 + 500.50), lunch A 100
        receipts.create(new CreateReceiptRequest(1, SAB1, "Jane Doe", List.of(
            new LineRequest(tithe, false, null, "500"),
            new LineRequest(null, true, null, "1001"),
            new LineRequest(lunch, false, groupA, "100"))));
        // Sabbath 1: John: tithe 200, camp expense 50
        receipts.create(new CreateReceiptRequest(2, SAB1, "John Okello", List.of(
            new LineRequest(tithe, false, null, "200"),
            new LineRequest(camp, false, null, "50"))));
        // Sabbath 2: Jane: tithe 300, lunch B 75.50
        receipts.create(new CreateReceiptRequest(3, SAB2, "Jane Doe", List.of(
            new LineRequest(tithe, false, null, "300"),
            new LineRequest(lunch, false, groupB, "75.50"))));
    }

    private long id(String name) {
        return jdbc.queryForObject("SELECT id FROM items WHERE name = ?", Long.class, name);
    }

    private FundTotal fund(SummaryReport r, String name) {
        return r.funds().stream().filter(f -> f.fundName().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void oneSabbathTotalsPerItemFundAndOverall() {
        SummaryReport r = reports.summary(SAB1, SAB1);
        assertThat(r.receiptCount()).isEqualTo(2);
        // Trust: tithe 700 + offerings half 500.50 = 1,200.50. Local: lcb half 500.50 + lunch 100 + camp 50 = 650.50
        assertThat(fund(r, "Trust Fund").totalHundredths()).isEqualTo(120_050);
        assertThat(fund(r, "Local Fund").totalHundredths()).isEqualTo(65_050);
        assertThat(r.grandTotalHundredths()).isEqualTo(185_100);
        assertThat(fund(r, "Trust Fund").items()).extracting(SummaryReport.ItemTotal::itemName)
            .containsExactly("Tithe", "Offerings 50%");   // items with no money are left out
    }

    @Test
    void aPeriodAddsSabbathsAndShowsSubgroups() {
        SummaryReport r = reports.summary(SAB1, SAB2);
        assertThat(r.receiptCount()).isEqualTo(3);
        assertThat(r.grandTotalHundredths()).isEqualTo(185_100 + 30_000 + 7_550);
        var lunchTotal = fund(r, "Local Fund").items().stream().filter(i -> i.itemName().equals("Lunch")).findFirst().orElseThrow();
        assertThat(lunchTotal.totalHundredths()).isEqualTo(17_550);
        assertThat(lunchTotal.subgroups()).extracting(SummaryReport.SubTotal::name).containsExactly("Group A", "Group B");
    }

    @Test
    void deletedReceiptsAreNotCounted() {
        long id = receipts.search(SAB1, SAB1, "John", false).get(0).id();
        receipts.delete(id, "entered twice");
        assertThat(reports.summary(SAB1, SAB1).grandTotalHundredths()).isEqualTo(185_100 - 25_000);
        receipts.restore(id);
        assertThat(reports.summary(SAB1, SAB1).grandTotalHundredths()).isEqualTo(185_100);
    }

    @Test
    void anEditedReceiptCountsOnlyItsNewLines() {
        long id = receipts.search(SAB1, SAB1, "John", false).get(0).id();
        receipts.update(id, new CreateReceiptRequest(2, SAB1, "John Okello", List.of(new LineRequest(tithe, false, null, "10"))));
        assertThat(reports.summary(SAB1, SAB1).grandTotalHundredths()).isEqualTo(185_100 - 25_000 + 1_000);
    }

    @Test
    void emptyPeriodGivesZeroAndBothFunds() {
        SummaryReport r = reports.summary(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));
        assertThat(r.grandTotalHundredths()).isZero();
        assertThat(r.funds()).hasSize(2);
        assertThat(r.funds().get(0).items()).isEmpty();
    }

    @Test
    void wrongPeriodIsRejected() {
        assertThatThrownBy(() -> reports.summary(SAB2, SAB1)).isInstanceOf(ApiException.class);
    }

    @Test
    void personStatementTotalsAndOfferingShownAsOneLine() {
        PersonStatement s = reports.person("jane doe", SAB1, SAB2, null);
        assertThat(s.personName()).isEqualTo("Jane Doe");
        assertThat(s.totalHundredths()).isEqualTo(50_000 + 100_100 + 10_000 + 30_000 + 7_550);
        assertThat(s.receipts()).hasSize(2);
        assertThat(s.receipts().get(0).lines()).hasSize(3);
        assertThat(s.receipts().get(0).lines().get(1).itemName()).isEqualTo("Offering");
        assertThat(s.receipts().get(0).lines().get(1).amountHundredths()).isEqualTo(100_100);
        assertThat(s.byItem()).extracting(PersonStatement.ItemAmount::itemName).contains("Tithe", "Offering", "Lunch");
    }

    @Test
    void personStatementForOnePeriodAndOneItem() {
        assertThat(reports.person("Jane Doe", SAB2, SAB2, null).totalHundredths()).isEqualTo(30_000 + 7_550);
        assertThat(reports.person("Jane Doe", SAB1, SAB2, String.valueOf(tithe)).totalHundredths()).isEqualTo(80_000);
        assertThat(reports.person("Jane Doe", SAB1, SAB2, "offering").totalHundredths()).isEqualTo(100_100);
        assertThat(reports.person("Jane Doe", SAB1, SAB2, String.valueOf(camp)).totalHundredths()).isZero();
    }

    @Test
    void personStatementNeedsAKnownPerson() {
        assertThatThrownBy(() -> reports.person("Nobody Here", SAB1, SAB2, null)).hasMessageContaining("No saved person");
    }

    @Test
    void httpEndpoints() throws Exception {
        mvc.perform(get("/api/reports/summary").param("from", "2026-10-03").param("to", "2026-10-03"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.grandTotalHundredths").value(185_100));
        mvc.perform(get("/api/reports/person").param("name", "Jane Doe").param("from", "2026-10-01").param("to", "2026-10-31"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.receipts.length()").value(2));
        mvc.perform(get("/api/reports/summary").param("from", "2026-10-10").param("to", "2026-10-03"))
            .andExpect(status().isBadRequest());
    }
}
