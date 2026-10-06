package com.church.treasury.api;

import com.church.treasury.item.AdminCatalogDto;
import com.church.treasury.item.ItemAdminService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** The Items and sub-groups tab. Every change returns the refreshed list. */
@RestController
@RequestMapping("/api")
public class ItemAdminController {

    public record ItemRequest(@NotBlank @Size(max = 80) String name, Long fundId) {}
    public record NameRequest(@NotBlank @Size(max = 80) String name) {}

    private final ItemAdminService service;

    public ItemAdminController(ItemAdminService service) {
        this.service = service;
    }

    @GetMapping("/items")
    public AdminCatalogDto view() {
        return service.view();
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminCatalogDto createItem(@Valid @RequestBody ItemRequest body) {
        return service.createItem(body.fundId(), body.name());
    }

    @PutMapping("/items/{id}")
    public AdminCatalogDto updateItem(@PathVariable long id, @Valid @RequestBody ItemRequest body) {
        return service.updateItem(id, body.name(), body.fundId());
    }

    @DeleteMapping("/items/{id}")
    public AdminCatalogDto deleteItem(@PathVariable long id, @RequestParam String reason) {
        return service.deleteItem(id, reason);
    }

    @PostMapping("/items/{id}/restore")
    public AdminCatalogDto restoreItem(@PathVariable long id) {
        return service.restoreItem(id);
    }

    @PostMapping("/items/{id}/subgroups")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminCatalogDto createSub(@PathVariable long id, @Valid @RequestBody NameRequest body) {
        return service.createSub(id, body.name());
    }

    @PutMapping("/subgroups/{id}")
    public AdminCatalogDto renameSub(@PathVariable long id, @Valid @RequestBody NameRequest body) {
        return service.renameSub(id, body.name());
    }

    @DeleteMapping("/subgroups/{id}")
    public AdminCatalogDto deleteSub(@PathVariable long id, @RequestParam String reason) {
        return service.deleteSub(id, reason);
    }

    @PostMapping("/subgroups/{id}/restore")
    public AdminCatalogDto restoreSub(@PathVariable long id) {
        return service.restoreSub(id);
    }
}
