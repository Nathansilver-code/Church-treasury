package com.church.treasury.api;

import com.church.treasury.deleted.DeletedEntry;
import com.church.treasury.deleted.DeletedService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lists deleted receipts, items and sub-groups. Restoring uses each one's own restore call. */
@RestController
@RequestMapping("/api/deleted")
public class DeletedController {

    private final DeletedService service;

    public DeletedController(DeletedService service) {
        this.service = service;
    }

    @GetMapping
    public List<DeletedEntry> all() {
        return service.all();
    }
}
