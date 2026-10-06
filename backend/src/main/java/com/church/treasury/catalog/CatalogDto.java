package com.church.treasury.catalog;

import java.util.List;

/** The funds, items and sub-groups the receipt screens need. */
public record CatalogDto(List<FundDto> funds, List<ItemDto> items) {
    public record FundDto(long id, String name) {}
    public record SubGroupDto(long id, String name) {}
    public record ItemDto(long id, long fundId, String name, String systemKey, List<SubGroupDto> subgroups) {}
}
