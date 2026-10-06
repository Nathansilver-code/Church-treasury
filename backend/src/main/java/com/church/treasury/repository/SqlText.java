package com.church.treasury.repository;

/** Small helpers for building SQL text safely. */
public final class SqlText {
    private SqlText() {}

    /** Escapes % and _ so typed text is matched literally inside LIKE ... ESCAPE '\'. */
    public static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
