package com.church.treasury.receipt;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record CreateReceiptRequest(
    @NotNull @Min(1) Integer receiptNumber,
    @NotNull LocalDate date,
    @NotBlank String personName,
    @NotEmpty List<@Valid LineRequest> lines) {

    /** One item on the receipt. For the Offering choice, set offering=true (itemId is ignored). */
    public record LineRequest(Long itemId, boolean offering, Long subgroupId, @NotBlank String amount) {}
}
