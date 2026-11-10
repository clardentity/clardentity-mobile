import { describe, expect, it } from "@jest/globals";
import { firstNameOf, greetingFor } from "@/lib/greeting";

const at = (hour: number) => new Date(2026, 9, 29, hour, 0, 0);

describe("firstNameOf", () => {
  it("keeps a plain first name", () => {
    expect(firstNameOf("Aditya Manoj")).toBe("Aditya");
  });

  it("drops things that are not names", () => {
    expect(firstNameOf("jo@example.com")).toBeNull();
    expect(firstNameOf("J")).toBeNull();
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf("123abc")).toBeNull();
  });

  it("allows apostrophes and hyphens inside a name", () => {
    expect(firstNameOf("O'Neil")).toBe("O'Neil");
    expect(firstNameOf("Jean-Luc Picard")).toBe("Jean-Luc");
  });
});

describe("greetingFor", () => {
  it.each([
    [5, "morning", "Good morning, Joe"],
    [11, "morning", "Good morning, Joe"],
    [12, "afternoon", "Good afternoon, Joe"],
    [17, "evening", "Good evening, Joe"],
  ] as const)("at %i:00 is %s", (hour, band, text) => {
    expect(greetingFor("Joe", { now: at(hour) })).toEqual({ band, text });
  });

  it("says night owl in the small hours, and welcome back only to returning users", () => {
    expect(greetingFor("Joe", { now: at(23) }).text).toBe("Welcome back, night owl");
    expect(greetingFor("Joe", { now: at(3), firstRun: true }).text).toBe("Hello, night owl");
  });
});
