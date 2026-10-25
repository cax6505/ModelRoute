/**
 * Regression tests for the zod v3 → v4 upgrade (GHSA-mrhx-c7xc-m3w5).
 *
 * The app schemas migrated from the deprecated string format methods
 * (z.string().uuid()/url()/datetime()) to the top-level v4 APIs
 * (z.uuid(), z.url(), z.iso.datetime()) and the two-argument
 * z.record(keyType, valueType) form.
 *
 * The first test fails on zod v3 (which does not export these top-level
 * APIs) and passes on zod v4, proving the upgrade is in effect. The
 * remaining tests guard that the app's public request/error schemas keep
 * behaving the same after the migration.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiErrorSchema, RouteRequestSchema } from "@/lib/schemas";

describe("zod v4 migration", () => {
  it("exposes the top-level v4 format APIs the app schemas rely on", () => {
    expect(typeof z.uuid).toBe("function");
    expect(typeof z.url).toBe("function");
    expect(typeof z.iso?.datetime).toBe("function");
  });

  it("parses an idempotency key as a valid UUID through RouteRequestSchema", () => {
    const result = RouteRequestSchema.safeParse({
      prompt: "summarize the meeting notes",
      taskHint: "summarization",
      priority: "quality",
      stream: false,
      idempotencyKey: "61c6c4f0-7b2d-4f9a-8e3c-1a2b3c4d5e6f",
    });
    expect(result.success).toBe(true);
  });

  it("still accepts a details record in ApiErrorSchema", () => {
    const result = ApiErrorSchema.safeParse({
      error: "boom",
      code: "E001",
      details: { attempt: 3 },
    });
    expect(result.success).toBe(true);
  });
});
