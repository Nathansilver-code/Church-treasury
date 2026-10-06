package com.church.treasury.report;

import java.util.List;

/** What one person gave in a period, in total, per item, and receipt by receipt. */
public record PersonStatement(String personName, String from, String to, String itemFilter, long totalHundredths,
                              List<ItemAmount> byItem, List<StatementReceipt> receipts) {
    public record ItemAmount(String itemKey, String itemName, long totalHundredths) {}
    public record StatementReceipt(long receiptId, int receiptNumber, String date, long totalHundredths, List<StatementLine> lines) {}
    public record StatementLine(String itemName, String subgroupName, String fundName, long amountHundredths) {}
}
