package com.church.treasury.api;

import com.church.treasury.settings.SettingsDto;
import com.church.treasury.settings.SettingsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping
    public SettingsDto get() {
        return service.get();
    }

    @PutMapping
    public SettingsDto update(@Valid @RequestBody SettingsDto body) {
        return service.update(body);
    }
}
