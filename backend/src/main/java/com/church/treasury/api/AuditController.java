package com.church.treasury.api;

import com.church.treasury.audit.AuditService;
import com.church.treasury.audit.AuditService.Verification;
import com.church.treasury.repository.AuditRepository.Entry;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

/** Read-only view of the audit log. Entries can never be edited or removed through the API. */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService service;

    public AuditController(AuditService service) {
        this.service = service;
    }

    @GetMapping
    public List<Entry> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String q) {
        return service.search(from, to, action, q);
    }

    @GetMapping("/verify")
    public Verification verify() {
        return service.verify();
    }
}
