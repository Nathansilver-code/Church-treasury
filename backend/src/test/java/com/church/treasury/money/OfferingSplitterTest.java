package com.church.treasury.money;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class OfferingSplitterTest {

    @Test
    void splitsEvenAmountInHalf() {
        var s = OfferingSplitter.split(Money.parse("1000"));
        assertThat(s.trust()).isEqualTo(Money.parse("500"));
        assertThat(s.local()).isEqualTo(Money.parse("500"));
    }

    @Test
    void keepsDecimalsForOddWholeAmounts() {
        var s = OfferingSplitter.split(Money.parse("1001"));
        assertThat(s.trust().toPlainString()).isEqualTo("500.50");
        assertThat(s.local().toPlainString()).isEqualTo("500.50");
    }

    @Test
    void oddHundredthGoesToLocalFundAndHalvesStillAddUp() {
        var s = OfferingSplitter.split(Money.parse("1000.01"));
        assertThat(s.trust().toPlainString()).isEqualTo("500.00");
        assertThat(s.local().toPlainString()).isEqualTo("500.01");
        assertThat(s.total()).isEqualTo(Money.parse("1000.01"));
    }

    @Test
    void halvesAlwaysAddBackToOriginal() {
        for (long h = 1; h <= 100_000; h += 7) {
            Money original = Money.ofHundredths(h);
            assertThat(OfferingSplitter.split(original).total()).isEqualTo(original);
        }
    }

    @Test
    void rejectsZeroAndNegative() {
        assertThatThrownBy(() -> OfferingSplitter.split(Money.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfferingSplitter.split(Money.parse("-5"))).isInstanceOf(IllegalArgumentException.class);
    }
}
