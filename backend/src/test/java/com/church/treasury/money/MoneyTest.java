package com.church.treasury.money;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class MoneyTest {

    @Test
    void parsesWholeAndDecimalAmounts() {
        assertThat(Money.parse("1001").hundredths()).isEqualTo(100100);
        assertThat(Money.parse("500.50").hundredths()).isEqualTo(50050);
        assertThat(Money.parse("500.5").hundredths()).isEqualTo(50050);
        assertThat(Money.parse(" 1,001.25 ").hundredths()).isEqualTo(100125);
    }

    @Test
    void rejectsMoreThanTwoDecimals() {
        assertThatThrownBy(() -> Money.parse("10.001")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsGarbageAndBlank() {
        assertThatThrownBy(() -> Money.parse("abc")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Money.parse("  ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Money.parse(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void totalsAreExactEvenWithManySmallAmounts() {
        // 0.10 added 10,000 times must be exactly 1,000.00 (floating point would drift)
        List<Money> tenCents = java.util.Collections.nCopies(10_000, Money.parse("0.10"));
        assertThat(Money.sum(tenCents)).isEqualTo(Money.parse("1000"));
    }

    @Test
    void formatsForDisplay() {
        assertThat(Money.parse("1001").toString()).isEqualTo("1,001.00");
        assertThat(Money.parse("500.5").toPlainString()).isEqualTo("500.50");
        assertThat(Money.ZERO.toString()).isEqualTo("0.00");
    }

    @Test
    void plusAndMinus() {
        assertThat(Money.parse("10.25").plus(Money.parse("0.75"))).isEqualTo(Money.parse("11"));
        assertThat(Money.parse("10").minus(Money.parse("0.01")).toPlainString()).isEqualTo("9.99");
    }
}
