import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney, splitOffering, toPlain } from "./money";

describe("parseMoney", () => {
  it("parses whole and decimal amounts", () => {
    expect(parseMoney("1001")).toBe(100100);
    expect(parseMoney("500.5")).toBe(50050);
    expect(parseMoney(" 1,001.25 ")).toBe(100125);
  });
  it("rejects invalid input", () => {
    expect(parseMoney("10.001")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("adds separators and two decimals", () => {
    expect(formatMoney(100100)).toBe("1,001.00");
    expect(formatMoney(50050)).toBe("500.50");
    expect(formatMoney(0)).toBe("0.00");
  });
});

describe("splitOffering", () => {
  it("keeps decimals", () => {
    expect(splitOffering(100100)).toEqual({ trust: 50050, local: 50050 });
  });
  it("gives the odd hundredth to the Local Fund and always adds up", () => {
    expect(splitOffering(100001)).toEqual({ trust: 50000, local: 50001 });
    for (let h = 1; h <= 100000; h += 7) {
      const s = splitOffering(h);
      expect(s.trust + s.local).toBe(h);
    }
  });
});

describe("toPlain", () => {
  it("gives text that parseMoney reads back exactly", () => {
    expect(toPlain(100100)).toBe("1001.00");
    expect(toPlain(50050)).toBe("500.50");
    for (const h of [1, 99, 100, 123456789]) expect(parseMoney(toPlain(h))).toBe(h);
  });
});
