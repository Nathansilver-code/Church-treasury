package com.church.treasury.settings;

import com.church.treasury.audit.AuditService;
import com.church.treasury.repository.SettingsRepository;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    public static final String DEFAULT_CURRENCY = "UGX";

    private final SettingsRepository repo;
    private final AuditService audit;

    public SettingsService(SettingsRepository repo, AuditService audit) {
        this.repo = repo;
        this.audit = audit;
    }

    public SettingsDto get() {
        Map<String, String> m = repo.all();
        String currency = m.getOrDefault("currency", "");
        return new SettingsDto(
            m.getOrDefault("churchName", ""),
            m.getOrDefault("address", ""),
            m.getOrDefault("treasurerName", ""),
            currency.isBlank() ? DEFAULT_CURRENCY : currency,
            m.getOrDefault("receiptFooter", ""));
    }

    @Transactional
    public SettingsDto update(SettingsDto in) {
        SettingsDto before = get();
        String currency = clean(in.currency()).toUpperCase();
        SettingsDto after = new SettingsDto(
            clean(in.churchName()), clean(in.address()), clean(in.treasurerName()),
            currency.isEmpty() ? DEFAULT_CURRENCY : currency, clean(in.receiptFooter()));
        repo.put("churchName", after.churchName());
        repo.put("address", after.address());
        repo.put("treasurerName", after.treasurerName());
        repo.put("currency", after.currency());
        repo.put("receiptFooter", after.receiptFooter());
        audit.log("UPDATE", "settings", null, describe(before), describe(after), null);
        return after;
    }

    private static String clean(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", " ");
    }

    private static String describe(SettingsDto s) {
        return "church name: " + s.churchName() + "; address: " + s.address() + "; treasurer: " + s.treasurerName()
            + "; currency: " + s.currency() + "; footer: " + s.receiptFooter();
    }
}
