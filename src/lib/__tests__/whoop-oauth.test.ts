import { describe, expect, it } from "vitest";
import { WHOOP_SCOPES } from "../whoop.server";
import { whoopWebReturn, whoopCallbackLocation } from "../whoop-return";

describe("WHOOP OAuth permissions", () => {
  it("requests only offline access and the three synced data permissions", () => {
    expect(WHOOP_SCOPES.split(" ")).toEqual([
      "offline",
      "read:recovery",
      "read:cycles",
      "read:sleep",
    ]);
  });
});

describe("WHOOP returns to the existing Cove session", () => {
  const preview = "https://id-preview--603412a2-6b56-45ee-9ba4-200bab1c07f1.lovable.app";
  it("returns a preview popup to its initiating origin instead of production login", () => {
    expect(whoopCallbackLocation(whoopWebReturn(preview, true), "connected"))
      .toBe(`${preview}/whoop-return?whoop=connected`);
  });
  it("accepts rotated preview deployment hosts for this project", () => {
    const rotated = "https://id-preview-dc5c2018--603412a2-6b56-45ee-9ba4-200bab1c07f1.lovable.app";
    expect(whoopCallbackLocation(whoopWebReturn(rotated, true), "connected"))
      .toBe(`${rotated}/whoop-return?whoop=connected`);
  });
  it("rejects preview hosts of other projects", () => {
    expect(() => whoopWebReturn("https://id-preview-dc5c2018--aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.lovable.app", true)).toThrow();
  });
  it("returns live users directly to Settings", () => {
    expect(whoopCallbackLocation(whoopWebReturn("https://cove-companion.lovable.app", false), "connected"))
      .toBe("https://cove-companion.lovable.app/settings?whoop=connected");
  });
  it("rejects untrusted initiating origins", () => {
    expect(() => whoopWebReturn("https://attacker.example", true)).toThrow();
  });
  it("does not follow tampered destinations", () => {
    expect(whoopCallbackLocation(`${preview}.attacker.example/settings`, "error"))
      .toBe("https://cove-companion.lovable.app/settings?whoop=error");
  });
  it("preserves iPhone callback behavior", () => {
    expect(whoopCallbackLocation("ios", "connected")).toBe("cove://whoop-callback?status=connected");
  });
});