package com.church.treasury.settings;

import jakarta.validation.constraints.Size;

/** The options the treasurer sets once. They appear on receipts and on PDF/Excel reports. */
public record SettingsDto(
    @Size(max = 120) String churchName,
    @Size(max = 160) String address,
    @Size(max = 80) String treasurerName,
    @Size(max = 8) String currency,
    @Size(max = 200) String receiptFooter) {}
