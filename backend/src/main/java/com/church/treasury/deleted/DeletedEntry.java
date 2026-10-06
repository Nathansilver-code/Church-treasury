package com.church.treasury.deleted;

/** Something that was deleted and can be restored. type is "receipt", "item" or "subgroup". */
public record DeletedEntry(String type, long id, String label, String deletedAt, String reason) {}
