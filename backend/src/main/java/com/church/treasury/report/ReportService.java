package com.church.treasury.report;

import com.church.treasury.api.ApiException;
import com.church.treasury.catalog.CatalogDto.FundDto;
import com.church.treasury.repository.CatalogRepository;
import com.church.treasury.repository.PersonRepository;
import com.church.treasury.repository.ReportRepository;
import com.church.treasury.repository.ReportRepository.PersonLine;
import com.church.treasury.repository.ReportRepository.SummaryRow;
import com.church.treasury.report.PersonStatement.ItemAmount;
import com.church.treasury.report.PersonStatement.StatementLine;
import com.church.treasury.report.PersonStatement.StatementReceipt;
import com.church.treasury.report.SummaryReport.FundTotal;
import com.church.treasury.report.SummaryReport.ItemTotal;
import com.church.treasury.report.SummaryReport.SubTotal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Builds the totals shown in Reports and Person statements. Reads only; changes nothing. */
@Service
public class ReportService {

    private static final String OFFERING_KEY = "offering";

    private final ReportRepository reports;
    private final CatalogRepository catalog;
    private final PersonRepository people;

    public ReportService(ReportRepository reports, CatalogRepository catalog, PersonRepository people) {
        this.reports = reports;
        this.catalog = catalog;
        this.people = people;
    }

    public SummaryReport summary(LocalDate from, LocalDate to) {
        checkPeriod(from, to);
        Map<Long, long[]> fundTotals = new LinkedHashMap<>();
        Map<Long, Map<Long, ItemBuilder>> itemsByFund = new LinkedHashMap<>();
        for (FundDto f : catalog.funds()) {
            fundTotals.put(f.id(), new long[] {0});
            itemsByFund.put(f.id(), new LinkedHashMap<>());
        }
        long grand = 0;
        for (SummaryRow r : reports.summaryRows(from, to)) {
            fundTotals.get(r.fundId())[0] += r.total();
            grand += r.total();
            ItemBuilder b = itemsByFund.get(r.fundId()).computeIfAbsent(r.itemId(), k -> new ItemBuilder(r.itemName()));
            b.total += r.total();
            b.subs.add(new SubTotal(r.subgroupId(), r.subgroupName() == null ? "No sub-group" : r.subgroupName(), r.total()));
        }
        List<FundTotal> funds = new ArrayList<>();
        for (FundDto f : catalog.funds()) {
            List<ItemTotal> items = new ArrayList<>();
            for (Map.Entry<Long, ItemBuilder> e : itemsByFund.get(f.id()).entrySet()) {
                ItemBuilder b = e.getValue();
                boolean hasRealSub = b.subs.stream().anyMatch(s -> s.subgroupId() != null);
                items.add(new ItemTotal(e.getKey(), b.name, b.total, hasRealSub ? b.subs : List.of()));
            }
            funds.add(new FundTotal(f.id(), f.name(), fundTotals.get(f.id())[0], items));
        }
        return new SummaryReport(from.toString(), to.toString(), reports.receiptCount(from, to), grand, funds);
    }

    /**
     * One person's giving in a period. item: blank for all items, "offering", or an item id.
     * The two halves of an Offering are shown together as one "Offering" amount.
     */
    public PersonStatement person(String name, LocalDate from, LocalDate to, String item) {
        checkPeriod(from, to);
        String clean = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (clean.isEmpty()) {
            throw ApiException.badRequest("Enter the person's name.");
        }
        long personId = people.findIdByName(clean)
            .orElseThrow(() -> ApiException.notFound("No saved person is named \"" + clean + "\"."));
        String filter = item == null ? "" : item.trim();
        Long itemId = null;
        if (!filter.isEmpty() && !filter.equals(OFFERING_KEY)) {
            try {
                itemId = Long.parseLong(filter);
            } catch (NumberFormatException e) {
                throw ApiException.badRequest("Unknown item filter.");
            }
        }

        Map<Long, StatementBuilder> receipts = new LinkedHashMap<>();
        Map<String, ItemBuilder> byItem = new LinkedHashMap<>();
        long total = 0;
        for (PersonLine l : reports.personLines(personId, from, to)) {
            boolean isOffering = l.splitGroup() != null;
            if (filter.equals(OFFERING_KEY) && !isOffering) continue;
            if (itemId != null && (isOffering || l.itemId() != itemId)) continue;

            total += l.amount();
            String key = isOffering ? OFFERING_KEY : String.valueOf(l.itemId());
            byItem.computeIfAbsent(key, k -> new ItemBuilder(isOffering ? "Offering" : l.itemName())).total += l.amount();

            StatementBuilder sb = receipts.computeIfAbsent(l.receiptId(), k -> new StatementBuilder(l));
            sb.total += l.amount();
            if (isOffering) {
                // fold both halves of one Offering entry into a single line
                Integer at = sb.offeringAt.get(l.splitGroup());
                if (at == null) {
                    sb.offeringAt.put(l.splitGroup(), sb.lines.size());
                    sb.lines.add(new StatementLine("Offering", null, "Both funds", l.amount()));
                } else {
                    StatementLine old = sb.lines.get(at);
                    sb.lines.set(at, new StatementLine("Offering", null, "Both funds", old.amountHundredths() + l.amount()));
                }
            } else {
                sb.lines.add(new StatementLine(l.itemName(), l.subgroupName(), l.fundName(), l.amount()));
            }
        }

        List<ItemAmount> items = new ArrayList<>();
        byItem.forEach((k, b) -> items.add(new ItemAmount(k, b.name, b.total)));
        List<StatementReceipt> list = new ArrayList<>();
        for (Map.Entry<Long, StatementBuilder> e : receipts.entrySet()) {
            StatementBuilder b = e.getValue();
            list.add(new StatementReceipt(e.getKey(), b.number, b.date, b.total, b.lines));
        }
        return new PersonStatement(clean, from.toString(), to.toString(), filter.isEmpty() ? null : filter, total, items, list);
    }

    private static void checkPeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw ApiException.badRequest("Choose the start and end dates.");
        }
        if (from.isAfter(to)) {
            throw ApiException.badRequest("The start date must not be after the end date.");
        }
    }

    private static final class ItemBuilder {
        final String name;
        long total;
        final List<SubTotal> subs = new ArrayList<>();

        ItemBuilder(String name) {
            this.name = name;
        }
    }

    private static final class StatementBuilder {
        final int number;
        final String date;
        long total;
        final List<StatementLine> lines = new ArrayList<>();
        final Map<String, Integer> offeringAt = new LinkedHashMap<>();

        StatementBuilder(PersonLine first) {
            this.number = first.receiptNumber();
            this.date = first.date();
        }
    }
}
