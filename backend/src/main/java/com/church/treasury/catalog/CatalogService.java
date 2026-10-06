package com.church.treasury.catalog;

import com.church.treasury.repository.CatalogRepository;
import org.springframework.stereotype.Service;

@Service
public class CatalogService {

    private final CatalogRepository repo;

    public CatalogService(CatalogRepository repo) {
        this.repo = repo;
    }

    public CatalogDto catalog() {
        return new CatalogDto(repo.funds(), repo.activeItemsWithSubgroups());
    }
}
