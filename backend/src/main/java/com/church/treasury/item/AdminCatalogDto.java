package com.church.treasury.item;

import java.util.List;

/** What the Items and sub-groups tab shows: every fund with its items and their sub-groups. */
public record AdminCatalogDto(List<FundAdmin> funds) {
    public record FundAdmin(long id, String name, List<ItemAdmin> items) {}
    public record ItemAdmin(long id, String name, String systemKey, boolean used, List<SubAdmin> subgroups) {}
    public record SubAdmin(long id, String name, boolean used) {}
}
