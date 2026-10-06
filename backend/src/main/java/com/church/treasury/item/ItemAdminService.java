package com.church.treasury.item;

import com.church.treasury.api.ApiException;
import com.church.treasury.audit.AuditService;
import com.church.treasury.catalog.CatalogDto.FundDto;
import com.church.treasury.item.AdminCatalogDto.FundAdmin;
import com.church.treasury.item.AdminCatalogDto.ItemAdmin;
import com.church.treasury.item.AdminCatalogDto.SubAdmin;
import com.church.treasury.repository.CatalogRepository;
import com.church.treasury.repository.ItemRepository;
import com.church.treasury.repository.ItemRepository.ItemHeader;
import com.church.treasury.repository.ItemRepository.ItemRow;
import com.church.treasury.repository.ItemRepository.SubHeader;
import com.church.treasury.repository.ItemRepository.SubRow;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rules for adding, renaming, deleting and restoring items and sub-groups.
 * The two funds are fixed; only items inside them change. Past receipts are never affected:
 * deleting an item or sub-group only stops it being chosen on new receipts.
 */
@Service
public class ItemAdminService {

    private final ItemRepository items;
    private final CatalogRepository catalog;
    private final AuditService audit;

    public ItemAdminService(ItemRepository items, CatalogRepository catalog, AuditService audit) {
        this.items = items;
        this.catalog = catalog;
        this.audit = audit;
    }

    public AdminCatalogDto view() {
        Map<Long, List<SubAdmin>> subs = new HashMap<>();
        for (SubRow s : items.visibleSubgroups()) {
            subs.computeIfAbsent(s.itemId(), k -> new ArrayList<>()).add(new SubAdmin(s.id(), s.name(), s.used()));
        }
        Map<Long, List<ItemAdmin>> byFund = new HashMap<>();
        for (ItemRow i : items.visibleItems()) {
            byFund.computeIfAbsent(i.fundId(), k -> new ArrayList<>())
                .add(new ItemAdmin(i.id(), i.name(), i.systemKey(), i.used(), subs.getOrDefault(i.id(), List.of())));
        }
        List<FundAdmin> funds = new ArrayList<>();
        for (FundDto f : catalog.funds()) {
            funds.add(new FundAdmin(f.id(), f.name(), byFund.getOrDefault(f.id(), List.of())));
        }
        return new AdminCatalogDto(funds);
    }

    // ---------- items ----------

    @Transactional
    public AdminCatalogDto createItem(Long fundId, String rawName) {
        String name = cleanName(rawName);
        if (fundId == null || !items.fundExists(fundId)) {
            throw ApiException.badRequest("Choose the fund this item belongs to.");
        }
        if (items.itemNameTaken(name, 0)) {
            throw ApiException.conflict("An item named \"" + name + "\" already exists. If it was deleted, restore it from the Deleted tab.");
        }
        long id = items.insertItem(fundId, name);
        audit.log("CREATE", "item", id, null, name + " (fund " + fundId + ")", null);
        return view();
    }

    @Transactional
    public AdminCatalogDto updateItem(long id, String rawName, Long fundId) {
        ItemHeader h = editableItem(id);
        String name = cleanName(rawName);
        long newFund = fundId == null ? h.fundId() : fundId;
        if (!items.fundExists(newFund)) {
            throw ApiException.badRequest("Choose the fund this item belongs to.");
        }
        if (items.itemNameTaken(name, id)) {
            throw ApiException.conflict("An item named \"" + name + "\" already exists.");
        }
        if (newFund != h.fundId() && items.itemUsed(id)) {
            throw ApiException.conflict("This item already has receipts, so it cannot move to another fund. Past totals would change.");
        }
        items.updateItem(id, newFund, name);
        audit.log("UPDATE", "item", id, h.name() + " (fund " + h.fundId() + ")", name + " (fund " + newFund + ")", null);
        return view();
    }

    @Transactional
    public AdminCatalogDto deleteItem(long id, String reason) {
        ItemHeader h = editableItem(id);
        String why = requireReason(reason);
        items.markItemDeleted(id, Instant.now().toString(), why);
        audit.log("DELETE", "item", id, h.name(), null, why);
        return view();
    }

    @Transactional
    public AdminCatalogDto restoreItem(long id) {
        ItemHeader h = items.findItem(id).orElseThrow(() -> ApiException.notFound("Item not found."));
        if (!h.deleted()) {
            throw ApiException.conflict("This item is not deleted.");
        }
        items.restoreItem(id);
        audit.log("RESTORE", "item", id, null, h.name(), null);
        return view();
    }

    // ---------- sub-groups ----------

    @Transactional
    public AdminCatalogDto createSub(long itemId, String rawName) {
        ItemHeader item = editableItem(itemId);
        String name = cleanName(rawName);
        if (items.subNameTaken(itemId, name, 0)) {
            throw ApiException.conflict("\"" + item.name() + "\" already has a sub-group named \"" + name + "\". If it was deleted, restore it from the Deleted tab.");
        }
        long id = items.insertSub(itemId, name);
        audit.log("CREATE", "subgroup", id, null, item.name() + ": " + name, null);
        return view();
    }

    @Transactional
    public AdminCatalogDto renameSub(long id, String rawName) {
        SubHeader s = activeSub(id);
        String name = cleanName(rawName);
        if (items.subNameTaken(s.itemId(), name, id)) {
            throw ApiException.conflict("There is already a sub-group named \"" + name + "\" under this item.");
        }
        items.updateSub(id, name);
        audit.log("UPDATE", "subgroup", id, s.name(), name, null);
        return view();
    }

    @Transactional
    public AdminCatalogDto deleteSub(long id, String reason) {
        SubHeader s = activeSub(id);
        String why = requireReason(reason);
        items.markSubDeleted(id, Instant.now().toString(), why);
        audit.log("DELETE", "subgroup", id, s.name(), null, why);
        return view();
    }

    @Transactional
    public AdminCatalogDto restoreSub(long id) {
        SubHeader s = items.findSub(id).orElseThrow(() -> ApiException.notFound("Sub-group not found."));
        if (!s.deleted()) {
            throw ApiException.conflict("This sub-group is not deleted.");
        }
        ItemHeader item = items.findItem(s.itemId()).orElseThrow(() -> ApiException.notFound("Item not found."));
        if (item.deleted()) {
            throw ApiException.conflict("Restore the item \"" + item.name() + "\" first.");
        }
        items.restoreSub(id);
        audit.log("RESTORE", "subgroup", id, null, s.name(), null);
        return view();
    }

    // ---------- helpers ----------

    private ItemHeader editableItem(long id) {
        ItemHeader h = items.findItem(id).orElseThrow(() -> ApiException.notFound("Item not found."));
        if (h.systemKey() != null) {
            throw ApiException.conflict("\"" + h.name() + "\" is built in (it is used for the Offering split) and cannot be changed.");
        }
        if (h.deleted()) {
            throw ApiException.conflict("This item is deleted. Restore it first.");
        }
        return h;
    }

    private SubHeader activeSub(long id) {
        SubHeader s = items.findSub(id).orElseThrow(() -> ApiException.notFound("Sub-group not found."));
        if (s.deleted()) {
            throw ApiException.conflict("This sub-group is deleted. Restore it first.");
        }
        return s;
    }

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) {
            throw ApiException.badRequest("Enter a name.");
        }
        if (name.length() > 80) {
            throw ApiException.badRequest("The name is too long (80 letters at most).");
        }
        return name;
    }

    private static String requireReason(String reason) {
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty()) {
            throw ApiException.badRequest("Give a reason for deleting.");
        }
        return why;
    }
}
