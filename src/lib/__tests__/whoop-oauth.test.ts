import { describe, expect, it } from "vitest";
import { WHOOP_SCOPES } from "../whoop.server";

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