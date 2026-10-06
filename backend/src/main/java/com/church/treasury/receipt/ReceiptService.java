package com.church.treasury.receipt;

import com.church.treasury.api.ApiException;
import com.church.treasury.audit.AuditService;
import com.church.treasury.money.Money;
import com.church.treasury.money.OfferingSplitter;
import com.church.treasury.receipt.ReceiptDetail.LineView;
import com.church.treasury.repository.CatalogRepository;
import com.church.treasury.repository.PersonRepository;
import com.church.treasury.repository.ReceiptRepository;
import com.church.treasury.repository.ReceiptRepository.Header;
import com.church.treasury.repository.ReceiptRepository.LineRow;
import com.church.treasury.repository.ReceiptRepository.Search;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The business rules for receipts: numbering, checking every line, the 50/50
 * offering split, edit, delete and restore. It never writes SQL; all database
 * work goes through the repository classes.
 */
@Service
public class ReceiptService {

    /** A line that has been checked and is ready to be written. */
    private record Prepared(Long itemId, boolean offering, Long subgroupId, Money amount) {}

    private final ReceiptRepository receipts;
    private final PersonRepository people;
    private final CatalogRepository catalog;
    private final AuditService audit;

    public ReceiptService(ReceiptRepository receipts, PersonRepository people, CatalogRepository catalog, AuditService audit) {
        this.receipts = receipts;
        this.people = people;
        this.catalog = catalog;
        this.audit = audit;
    }

    // ---------- reading ----------

    public int nextNumber() {
        return receipts.nextNumber();
    }

    public List<ReceiptSummary> listForDate(LocalDate date) {
        return receipts.search(new Search(date, date, null, false));
    }

    public List<ReceiptSummary> search(LocalDate from, LocalDate to, String text, boolean includeDeleted) {
        return receipts.search(new Search(from, to, text, includeDeleted));
    }

    public ReceiptDetail detail(long id) {
        Header h = receipts.findHeader(id).orElseThrow(() -> ApiException.notFound("Receipt not found."));
        List<LineView> views = new ArrayList<>();
        Map<String, Integer> offeringAt = new HashMap<>();
        long total = 0;
        for (LineRow row : receipts.findLines(id)) {
            total += row.amountHundredths();
            if (row.splitGroup() == null) {
                views.add(new LineView(row.itemId(), false, row.subgroupId(), row.itemName(), row.subgroupName(),
                    row.fundName(), row.amountHundredths()));
            } else {
                // the two halves of one Offering entry are shown again as a single line
                Integer at = offeringAt.get(row.splitGroup());
                if (at == null) {
                    offeringAt.put(row.splitGroup(), views.size());
                    views.add(new LineView(null, true, null, "Offering", null, "Both funds", row.amountHundredths()));
                } else {
                    LineView old = views.get(at);
                    views.set(at, new LineView(null, true, null, "Offering", null, "Both funds",
                        old.amountHundredths() + row.amountHundredths()));
                }
            }
        }
        return new ReceiptDetail(h.id(), h.number(), h.date(), h.personName(), h.deleted(), h.deleteReason(), total, views);
    }

    // ---------- writing ----------

    @Transactional
    public ReceiptSummary create(CreateReceiptRequest req) {
        String name = cleanName(req.personName());
        int number = req.receiptNumber();
        if (receipts.numberExists(number, 0)) {
            throw ApiException.conflict("Receipt number " + number + " is already used. Change the number.");
        }
        List<Prepared> prepared = prepare(req.lines());   // every line is checked before anything is written

        long personId = findOrCreatePerson(name);
        long receiptId = receipts.insertReceipt(number, req.date().toString(), personId, Instant.now().toString());
        Money total = writeLines(receiptId, prepared);

        audit.log("CREATE", "receipt", receiptId, null,
            "receipt " + number + " for " + name + " on " + req.date() + ", total " + total.toPlainString()
                + ", " + prepared.size() + " item(s)", null);
        return new ReceiptSummary(receiptId, number, req.date().toString(), name, total.hundredths(), false, null);
    }

    /** Changes the number, date, person and items. The old lines stay in the database, flagged as replaced. */
    @Transactional
    public ReceiptDetail update(long id, CreateReceiptRequest req) {
        Header h = receipts.findHeader(id).orElseThrow(() -> ApiException.notFound("Receipt not found."));
        if (h.deleted()) {
            throw ApiException.conflict("This receipt is deleted. Restore it before editing.");
        }
        String name = cleanName(req.personName());
        if (receipts.numberExists(req.receiptNumber(), id)) {
            throw ApiException.conflict("Receipt number " + req.receiptNumber() + " is already used. Change the number.");
        }
        List<Prepared> prepared = prepare(req.lines());

        String before = snapshot(detail(id));
        long personId = findOrCreatePerson(name);
        receipts.updateHeader(id, req.receiptNumber(), req.date().toString(), personId);
        receipts.markLinesDeleted(id, Instant.now().toString(), "replaced by edit");
        writeLines(id, prepared);

        ReceiptDetail after = detail(id);
        audit.log("UPDATE", "receipt", id, before, snapshot(after), null);
        return after;
    }

    /** Deleting hides the receipt from lists and totals but keeps all its data, with the reason. */
    @Transactional
    public ReceiptDetail delete(long id, String reason) {
        Header h = receipts.findHeader(id).orElseThrow(() -> ApiException.notFound("Receipt not found."));
        if (h.deleted()) {
            throw ApiException.conflict("This receipt is already deleted.");
        }
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty()) {
            throw ApiException.badRequest("Give a reason for deleting this receipt.");
        }
        String before = snapshot(detail(id));
        receipts.markReceiptDeleted(id, Instant.now().toString(), why);
        audit.log("DELETE", "receipt", id, before, null, why);
        return detail(id);
    }

    @Transactional
    public ReceiptDetail restore(long id) {
        Header h = receipts.findHeader(id).orElseThrow(() -> ApiException.notFound("Receipt not found."));
        if (!h.deleted()) {
            throw ApiException.conflict("This receipt is not deleted.");
        }
        receipts.restoreReceipt(id);
        ReceiptDetail restored = detail(id);
        audit.log("RESTORE", "receipt", id, null, snapshot(restored), null);
        return restored;
    }

    // ---------- helpers ----------

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) {
            throw ApiException.badRequest("Enter the person's name.");
        }
        return name;
    }

    private List<Prepared> prepare(List<CreateReceiptRequest.LineRequest> lines) {
        List<Prepared> out = new ArrayList<>();
        for (CreateReceiptRequest.LineRequest l : lines) {
            Money amount = Money.parse(l.amount());
            if (!amount.isPositive()) {
                throw ApiException.badRequest("Every amount must be greater than zero.");
            }
            if (!l.offering()) {
                checkItemAndSubgroup(l.itemId(), l.subgroupId());
            }
            out.add(new Prepared(l.itemId(), l.offering(), l.subgroupId(), amount));
        }
        return out;
    }

    private void checkItemAndSubgroup(Long itemId, Long subgroupId) {
        if (itemId == null) {
            throw ApiException.badRequest("Choose an item for every line.");
        }
        if (!catalog.isPickableItem(itemId)) {
            throw ApiException.badRequest("That item is not available.");
        }
        if (catalog.activeSubgroupCount(itemId) > 0) {
            if (subgroupId == null) {
                throw ApiException.badRequest("Choose a sub-group for this item.");
            }
            if (!catalog.subgroupBelongsToItem(subgroupId, itemId)) {
                throw ApiException.badRequest("That sub-group does not belong to this item.");
            }
        } else if (subgroupId != null) {
            throw ApiException.badRequest("This item has no sub-groups.");
        }
    }

    private Money writeLines(long receiptId, List<Prepared> prepared) {
        Money total = Money.ZERO;
        for (Prepared p : prepared) {
            total = total.plus(p.amount());
            if (p.offering()) {
                var split = OfferingSplitter.split(p.amount());
                String group = UUID.randomUUID().toString();
                receipts.insertLine(receiptId, catalog.systemItemId("OFFERING_TRUST"), null, split.trust().hundredths(), group);
                receipts.insertLine(receiptId, catalog.systemItemId("OFFERING_LOCAL"), null, split.local().hundredths(), group);
            } else {
                receipts.insertLine(receiptId, p.itemId(), p.subgroupId(), p.amount().hundredths(), null);
            }
        }
        return total;
    }

    private long findOrCreatePerson(String name) {
        return people.findIdByName(name).orElseGet(() -> {
            long id = people.insert(name);
            audit.log("CREATE", "person", id, null, name, null);
            return id;
        });
    }

    private static String snapshot(ReceiptDetail d) {
        String lines = d.lines().stream()
            .map(l -> l.itemName() + (l.subgroupName() != null ? " (" + l.subgroupName() + ")" : "") + " "
                + Money.ofHundredths(l.amountHundredths()).toPlainString())
            .collect(Collectors.joining("; "));
        return "receipt " + d.receiptNumber() + " for " + d.personName() + " on " + d.date() + ", total "
            + Money.ofHundredths(d.totalHundredths()).toPlainString() + ": " + lines;
    }
}
