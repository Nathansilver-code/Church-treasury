package com.church.treasury.report;

import java.util.List;

/** Totals for a period: per item (with sub-groups), per fund and overall. Items with no money are left out. */
public record SummaryReport(String from, String to, int receiptCount, long grandTotalHundredths, List<FundTotal> funds) {
    public record FundTotal(long fundId, String fundName, long totalHundredths, List<ItemTotal> items) {}
    public record ItemTotal(long itemId, String itemName, long totalHundredths, List<SubTotal> subgroups) {}
    public record SubTotal(Long subgroupId, String name, long totalHundredths) {}
}
