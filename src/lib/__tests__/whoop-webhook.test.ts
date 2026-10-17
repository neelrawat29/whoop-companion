import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { removedImportPatch, sleepFields, verifyWhoopSignature, whoopWebhookSchema } from "../whoop-webhook";

const raw = JSON.stringify({ user_id: 123, id: "550e8400-e29b-41d4-a716-446655440000", type: "sleep.updated", trace_id: "test-event" });
const timestamp = "1792216680000";
const secret = "test-only-client-secret";
const sign = (body: string) => createHmac("sha256", secret).update(timestamp + body).digest("base64");
describe("WHOOP webhook security and imports", () => {
  it("accepts WHOOP timestamp plus raw-body signatures", async () => {
    expect(await verifyWhoopSignature(raw, timestamp, sign(raw), secret, Number(timestamp))).toBe(true);
  });
  it("rejects changes to the signed body", async () => {
    expect(await verifyWhoopSignature(raw + " ", timestamp, sign(raw), secret, Number(timestamp))).toBe(false);
  });
  it("rejects stale webhook signatures", async () => {
    expect(await verifyWhoopSignature(raw, timestamp, sign(raw), secret, Number(timestamp) + 300001)).toBe(false);
  });
  it("rejects absent and incorrect signatures", async () => {
    expect(await verifyWhoopSignature(raw, timestamp, null, secret, Number(timestamp))).toBe(false);
    expect(await verifyWhoopSignature(raw, timestamp, "bad", secret, Number(timestamp))).toBe(false);
  });
  it("accepts v2 sleep identifiers", () => {
    expect(whoopWebhookSchema.parse(JSON.parse(raw)).id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
  it("rejects unsupported events and invalid user identities", () => {
    expect(whoopWebhookSchema.safeParse({ ...JSON.parse(raw), type: "cycle.updated" }).success).toBe(false);
    expect(whoopWebhookSchema.safeParse({ ...JSON.parse(raw), user_id: -1 }).success).toBe(false);
  });
  it("preserves manual entries during WHOOP deletions", () => {
    expect(removedImportPatch({ source: "manual", sleep_score: 85 }, { sleep_score: 85 }, sleepFields)).toEqual({});
  });
  it("clears only matching imported sleep values, not recovery or later edits", () => {
    expect(removedImportPatch({ source: "whoop", sleep_score: 85, sleep_hours: 8, recovery: 60 }, { sleep_score: 85, sleep_hours: 7, recovery: 60 }, sleepFields)).toEqual({ sleep_score: null });
  });
});