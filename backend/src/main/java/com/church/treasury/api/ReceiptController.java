package com.church.treasury.api;

import com.church.treasury.receipt.CreateReceiptRequest;
import com.church.treasury.receipt.ReceiptDetail;
import com.church.treasury.receipt.ReceiptService;
import com.church.treasury.receipt.ReceiptSummary;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** HTTP only: reads the request, calls ReceiptService, returns the result. No rules and no SQL here. */
@RestController
@RequestMapping("/api/receipts")
public class ReceiptController {

    private final ReceiptService service;

    public ReceiptController(ReceiptService service) {
        this.service = service;
    }

    @GetMapping("/next-number")
    public Map<String, Integer> nextNumber() {
        return Map.of("number", service.nextNumber());
    }

    /** Receipts of one date (used by the New receipt screen). */
    @GetMapping
    public List<ReceiptSummary> list(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.listForDate(date);
    }

    /** Receipts tab: filter by date range, name or number; optionally include deleted ones. */
    @GetMapping("/search")
    public List<ReceiptSummary> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return service.search(from, to, q, includeDeleted);
    }

    @GetMapping("/{id}")
    public ReceiptDetail get(@PathVariable long id) {
        return service.detail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReceiptSummary create(@Valid @RequestBody CreateReceiptRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public ReceiptDetail update(@PathVariable long id, @Valid @RequestBody CreateReceiptRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ReceiptDetail delete(@PathVariable long id, @RequestParam String reason) {
        return service.delete(id, reason);
    }

    @PostMapping("/{id}/restore")
    public ReceiptDetail restore(@PathVariable long id) {
        return service.restore(id);
    }
}
