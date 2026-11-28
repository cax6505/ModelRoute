/**
 * Regression test for @supabase/supabase-js storage URL boundary validation.
 *
 * Object paths that escape the configured bucket endpoint must be rejected
 * locally by the SDK instead of sending a request to the storage endpoint.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient } from "@/lib/db/client";

describe("supabase storage object URL boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects object paths that escape the bucket endpoint without a request", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new Error("network should not be reached"));
    vi.stubGlobal("fetch", fetchSpy);

    const client = createSupabaseClient();
    const { data, error } = await client.storage
      .from("..")
      .upload("file.txt", new Uint8Array([1, 2, 3]));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/escapes the intended bucket endpoint/i);
  });
});
