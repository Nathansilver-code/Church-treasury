package com.church.treasury.api;

import com.church.treasury.catalog.CatalogDto;
import com.church.treasury.catalog.CatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private final CatalogService service;

    public CatalogController(CatalogService service) {
        this.service = service;
    }

    @GetMapping
    public CatalogDto catalog() {
        return service.catalog();
    }
}
