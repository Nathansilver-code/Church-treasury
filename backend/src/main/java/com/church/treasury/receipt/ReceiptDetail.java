package com.church.treasury.receipt;

import java.util.List;

/** A whole receipt as the person sees it: an Offering is shown as one line with the full amount. */
public record ReceiptDetail(long id, int receiptNumber, String date, String personName, boolean deleted,
                            String deleteReason, long totalHundredths, List<LineView> lines) {

    public record LineView(Long itemId, boolean offering, Long subgroupId, String itemName, String subgroupName,
                           String fundName, long amountHundredths) {}
}
