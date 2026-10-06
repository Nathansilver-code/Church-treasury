package com.church.treasury.item;

import com.church.treasury.TestDb;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.church.treasury.api.ApiException;
import com.church.treasury.item.AdminCatalogDto.ItemAdmin;
import com.church.treasury.receipt.CreateReceiptRequest;
import com.church.treasury.receipt.CreateReceiptRequest.LineRequest;
import com.church.treasury.receipt.ReceiptService;
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
class ItemAdminTest {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        TestDb.use(r, "items");
    }

    @Autowired ItemAdminService service;
    @Autowired ReceiptService receipts;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void reset() {
        jdbc.update("DELETE FROM audit_log");
        jdbc.update("DELETE FROM receipt_lines");
        jdbc.update("DELETE FROM receipts");
        jdbc.update("DELETE FROM people");
        jdbc.update("DELETE FROM subgroups");
        jdbc.update("DELETE FROM items WHERE id > 20");
        jdbc.update("UPDATE items SET deleted_at = NULL, delete_reason = NULL");
    }

    private ItemAdmin find(AdminCatalogDto view, String name) {
        return view.funds().stream().flatMap(f -> f.items().stream()).filter(i -> i.name().equals(name)).findFirst().orElseThrow();
    }

    private long idOf(String itemName) {
        return jdbc.queryForObject("SELECT id FROM items WHERE name = ?", Long.class, itemName);
    }

    @Test
    void viewListsBothFundsWithTheSeededItems() {
        AdminCatalogDto v = service.view();
        assertThat(v.funds()).hasSize(2);
        assertThat(v.funds().get(0).items()).hasSize(6);
        assertThat(v.funds().get(1).items()).hasSize(14);
    }

    @Test
    void addingSubgroupsToLunchWorksAndTheyShowOnTheReceiptCatalog() {
        long lunch = idOf("Lunch");
        service.createSub(lunch, "Group A");
        service.createSub(lunch, "  Group   B ");
        ItemAdmin item = find(service.view(), "Lunch");
        assertThat(item.subgroups()).extracting(AdminCatalogDto.SubAdmin::name).containsExactly("Group A", "Group B");
    }

    @Test
    void newItemGoesIntoTheChosenFundAndNamesAreUnique() {
        AdminCatalogDto v = service.createItem(2L, "Youth Ministry");
        assertThat(v.funds().get(1).items()).extracting(ItemAdmin::name).contains("Youth Ministry");
        assertThatThrownBy(() -> service.createItem(1L, "youth ministry")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.createItem(99L, "Another")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.createItem(1L, "   ")).isInstanceOf(ApiException.class);
    }

    @Test
    void builtInOfferingItemsCannotBeChanged() {
        long half = idOf("Offerings 50%");
        assertThatThrownBy(() -> service.updateItem(half, "Renamed", null)).hasMessageContaining("built in");
        assertThatThrownBy(() -> service.deleteItem(half, "x")).hasMessageContaining("built in");
    }

    @Test
    void anItemWithReceiptsCanBeRenamedButNotMovedToAnotherFund() {
        long tithe = idOf("Tithe");
        receipts.create(new CreateReceiptRequest(1, LocalDate.of(2026, 10, 3), "Jane Doe", List.of(new LineRequest(tithe, false, null, "100"))));
        assertThat(find(service.updateItem(tithe, "Tithes", null), "Tithes").used()).isTrue();
        assertThatThrownBy(() -> service.updateItem(tithe, "Tithes", 2L)).hasMessageContaining("cannot move");
    }

    @Test
    void deleteNeedsAReasonAndRestoreBringsTheItemBack() {
        AdminCatalogDto v = service.createItem(2L, "Youth Ministry");
        long id = find(v, "Youth Ministry").id();
        assertThatThrownBy(() -> service.deleteItem(id, " ")).isInstanceOf(ApiException.class);
        AdminCatalogDto after = service.deleteItem(id, "not needed");
        assertThat(after.funds().get(1).items()).extracting(ItemAdmin::name).doesNotContain("Youth Ministry");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM items WHERE name = 'Youth Ministry'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE action = 'DELETE' AND reason = 'not needed'", Integer.class)).isEqualTo(1);
        // the name stays taken while it is deleted
        assertThatThrownBy(() -> service.createItem(2L, "Youth Ministry")).hasMessageContaining("Deleted tab");
        assertThat(service.restoreItem(id).funds().get(1).items()).extracting(ItemAdmin::name).contains("Youth Ministry");
    }

    @Test
    void aDeletedSubgroupDisappearsFromNewReceiptsAndCanBeRestoredOnlyWithItsItem() {
        long lunch = idOf("Lunch");
        service.createSub(lunch, "Group A");
        long sub = find(service.view(), "Lunch").subgroups().get(0).id();
        service.deleteSub(sub, "wrong name");
        assertThat(find(service.view(), "Lunch").subgroups()).isEmpty();
        service.deleteItem(lunch, "pause");
        assertThatThrownBy(() -> service.restoreSub(sub)).hasMessageContaining("Restore the item");
        service.restoreItem(lunch);
        service.restoreSub(sub);
        assertThat(find(service.view(), "Lunch").subgroups()).hasSize(1);
    }

    @Test
    void httpEndpointsWork() throws Exception {
        mvc.perform(get("/api/items")).andExpect(status().isOk()).andExpect(jsonPath("$.funds.length()").value(2));
        mvc.perform(post("/api/items").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Youth Ministry\",\"fundId\":2}"))
            .andExpect(status().isCreated());
        mvc.perform(post("/api/items").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Youth Ministry\",\"fundId\":2}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.message").exists());
        long id = idOf("Youth Ministry");
        mvc.perform(delete("/api/items/" + id).param("reason", "test")).andExpect(status().isOk());
        mvc.perform(post("/api/items/" + id + "/restore")).andExpect(status().isOk());
    }
}
