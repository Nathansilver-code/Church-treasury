import { describe, expect, it } from "vitest";
import { lastSabbath, monthRange, periodFor, yearRange } from "./periods";

describe("lastSabbath", () => {
  it("is today when today is Saturday", () => expect(lastSabbath("2026-10-03")).toBe("2026-10-03"));
  it("goes back to the previous Saturday on other days", () => {
    expect(lastSabbath("2026-10-04")).toBe("2026-10-03"); // Sunday
    expect(lastSabbath("2026-10-09")).toBe("2026-10-03"); // Friday
    expect(lastSabbath("2026-10-10")).toBe("2026-10-10"); // Saturday
  });
  it("crosses a month boundary", () => expect(lastSabbath("2026-11-02")).toBe("2026-10-31"));
});

describe("ranges", () => {
  it("month", () => expect(monthRange("2026-10-02")).toEqual({ from: "2026-10-01", to: "2026-10-31" }));
  it("last month across a year", () => expect(monthRange("2026-01-15", 1)).toEqual({ from: "2025-12-01", to: "2025-12-31" }));
  it("February in a leap year", () => expect(monthRange("2028-02-10").to).toBe("2028-02-29"));
  it("year", () => expect(yearRange("2026-10-02")).toEqual({ from: "2026-01-01", to: "2026-12-31" }));
  it("presets", () => expect(periodFor("sabbath", "2026-10-02")).toEqual({ from: "2026-09-26", to: "2026-09-26" }));
});
