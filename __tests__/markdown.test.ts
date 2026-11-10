import { describe, expect, it, jest } from "@jest/globals";
import { spaceLabels } from "@/lib/markdown";

// lib/markdown draws with the theme, which reads storage at import.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("spaceLabels", () => {
  it("puts a blank line above a bold label that follows a line break", () => {
    expect(spaceLabels("First point.\n**Slide 2 - Pricing**\nBody")).toBe(
      "First point.\n\n**Slide 2 - Pricing**\nBody",
    );
  });

  it("leaves a label that already has a blank line above it", () => {
    const text = "First point.\n\n**Slide 2**";
    expect(spaceLabels(text)).toBe(text);
  });

  it("leaves ordinary line breaks as written", () => {
    const text = "Roses are red\nViolets are blue";
    expect(spaceLabels(text)).toBe(text);
  });

  it("ignores bold text in the middle of a line", () => {
    const text = "One\nTwo with **bold** inside";
    expect(spaceLabels(text)).toBe(text);
  });
});
