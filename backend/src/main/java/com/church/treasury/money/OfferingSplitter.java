package com.church.treasury.money;

/**
 * Splits an offering 50/50 between Trust Fund ("Offerings 50%") and
 * Local Fund ("LCB 50%"). Decimals are kept: 1,001.00 becomes 500.50 + 500.50.
 *
 * If the amount has an odd number of hundredths (e.g. 1,000.01) it cannot be
 * halved exactly, so the Local Fund receives the extra hundredth. The two
 * halves ALWAYS add back to exactly the original amount.
 */
public final class OfferingSplitter {

    public record Split(Money trust, Money local) {
        public Money total() {
            return trust.plus(local);
        }
    }

    private OfferingSplitter() {}

    public static Split split(Money amount) {
        if (amount == null || !amount.isPositive()) {
            throw new IllegalArgumentException("Offering amount must be greater than zero");
        }
        long h = amount.hundredths();
        long trust = h / 2;
        long local = h - trust;
        return new Split(Money.ofHundredths(trust), Money.ofHundredths(local));
    }
}
