import { describe, expect, it } from "@jest/globals";
import { cleanMessageText } from "@/lib/text";

describe("cleanMessageText", () => {
  it("strips HTML tags", () => {
    expect(cleanMessageText("<strong>Hi</strong> there")).not.toMatch(/<\/?strong>/);
  });

  it("turns headings into bold lines", () => {
    expect(cleanMessageText("## Summary")).toBe("**Summary**");
  });

  it("normalises bold and italic syntax", () => {
    expect(cleanMessageText("__bold__ and _it_")).toBe("**bold** and *it*");
  });

  it("flattens links to text and url", () => {
    expect(cleanMessageText("[Docs](https://example.com)")).toBe("Docs (https://example.com)");
  });

  it("decodes entities", () => {
    expect(cleanMessageText("a &amp; b")).toBe("a & b");
  });

  it("leaves empty input alone", () => {
    expect(cleanMessageText("")).toBe("");
  });
});
