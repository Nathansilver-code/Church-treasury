package com.church.treasury.receipt;

/** One row in a list of receipts. Deleted receipts keep their data and are flagged. */
public record ReceiptSummary(long id, int receiptNumber, String date, String personName, long totalHundredths,
                             boolean deleted, String deleteReason) {}
