package com.church.treasury.money;

import java.math.BigDecimal;
import java.util.Collection;

/**
 * An exact amount of money, stored as a whole number of hundredths
 * (500.50 is stored as 50050). Never uses floating point, so totals
 * can never drift, no matter how many entries are added.
 */
public final class Money implements Comparable<Money> {

    public static final Money ZERO = new Money(0L);

    private final long hundredths;

    private Money(long hundredths) {
        this.hundredths = hundredths;
    }

    public static Money ofHundredths(long hundredths) {
        return new Money(hundredths);
    }

    /**
     * Parses what a person types, e.g. "1001", "1,001.50", " 500.5 ".
     * At most two decimal places are allowed.
     */
    public static Money parse(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Amount is required");
        }
        String cleaned = text.trim().replace(",", "").replace(" ", "");
        BigDecimal value;
        try {
            value = new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Not a valid amount: " + text);
        }
        if (value.stripTrailingZeros().scale() > 2) {
            throw new IllegalArgumentException("Use at most two decimal places: " + text);
        }
        try {
            return new Money(value.movePointRight(2).longValueExact());
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException("Amount is too large: " + text);
        }
    }

    public static Money sum(Collection<Money> amounts) {
        long total = 0L;
        for (Money m : amounts) {
            total = Math.addExact(total, m.hundredths);
        }
        return new Money(total);
    }

    public long hundredths() {
        return hundredths;
    }

    public Money plus(Money other) {
        return new Money(Math.addExact(hundredths, other.hundredths));
    }

    public Money minus(Money other) {
        return new Money(Math.subtractExact(hundredths, other.hundredths));
    }

    public boolean isPositive() {
        return hundredths > 0;
    }

    public boolean isZero() {
        return hundredths == 0;
    }

    /** Plain text with two decimals, e.g. "500.50". */
    public String toPlainString() {
        long abs = Math.abs(hundredths);
        return (hundredths < 0 ? "-" : "") + (abs / 100) + "." + String.format("%02d", abs % 100);
    }

    /** Display text with thousands separators, e.g. "1,001.00". */
    @Override
    public String toString() {
        long abs = Math.abs(hundredths);
        return (hundredths < 0 ? "-" : "") + String.format("%,d", abs / 100) + "." + String.format("%02d", abs % 100);
    }

    @Override
    public int compareTo(Money other) {
        return Long.compare(hundredths, other.hundredths);
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof Money m && m.hundredths == hundredths;
    }

    @Override
    public int hashCode() {
        return Long.hashCode(hundredths);
    }
}
