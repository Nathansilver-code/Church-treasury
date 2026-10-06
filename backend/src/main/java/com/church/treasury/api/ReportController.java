package com.church.treasury.api;

import com.church.treasury.report.PersonStatement;
import com.church.treasury.report.ReportService;
import com.church.treasury.report.SummaryReport;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    /** Totals per item, fund and overall. One Sabbath is simply from = to. */
    @GetMapping("/summary")
    public SummaryReport summary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.summary(from, to);
    }

    @GetMapping("/person")
    public PersonStatement person(
            @RequestParam String name,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String item) {
        return service.person(name, from, to, item);
    }
}
