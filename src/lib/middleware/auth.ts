/**
 * Auth middleware — validates API keys and Supabase sessions.
 *
 * API key format: mr_live_<32 hex bytes>
 * Stored as SHA-256 hash in database — the raw key is never persisted.
 *
 * SECURITY:
 * - API keys are looked up by prefix (first 8 chars) then verified by hash
 * - Revoked keys are rejected
 * - last_used_at is updated on successful auth and failures are observable
 */

import { getSupabaseAdmin, sha256 } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

const log = logger.child({ component: "auth" });
export const DASHBOARD_SESSION_COOKIE = "modelroute_dashboard_session";

export interface AuthResult {
  authenticated: boolean;
  authMethod?: "dashboard" | "api-key" | "supabase";
  userId?: string;
  keyId?: string;
  rateLimitRpm?: number;
  error?: string;
}

/** Resolve either a bearer API key or a Supabase browser session. */
export async function validateRequestAuth(
  request: NextRequest,
): Promise<AuthResult> {
  if (isDashboardSessionValid(request)) {
    return { authenticated: true, authMethod: "dashboard" };
  }

  const apiKeyAuth = await validateApiKey(request.headers.get("authorization"));
  if (apiKeyAuth.authenticated) return apiKeyAuth;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !request.cookies.getAll().length) return apiKeyAuth;

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => undefined,
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return apiKeyAuth;
    return { authenticated: true, authMethod: "supabase", userId: data.user.id };
  } catch (error) {
    log.warn("Supabase session lookup failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return apiKeyAuth;
  }

  function isDashboardSessionValid(request: NextRequest): boolean {
    const configuredKey = process.env.MODELROUTE_DASHBOARD_API_KEY;
    const sessionKey = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
    if (!configuredKey || !sessionKey) return false;

    const expected = Buffer.from(configuredKey);
    const actual = Buffer.from(sessionKey);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}

/**
 * Validate an API key from the Authorization header.
 * Returns the authenticated user ID if valid.
 */
export async function validateApiKey(
  authHeader: string | null,
): Promise<AuthResult> {
  if (!authHeader) {
    return { authenticated: false, error: "Missing Authorization header" };
  }

  // Extract Bearer token
  const match = authHeader.match(/^Bearer\s+(mr_live_[a-f0-9]+)$/i);
  if (!match) {
    return {
      authenticated: false,
      error: "Invalid API key format. Expected: Bearer mr_live_<key>",
    };
  }

  const rawKey = match[1];
  const keyPrefix = rawKey.substring(0, 16); // "mr_live_" + 8 hex chars

  try {
    // Hash the key for comparison
    const keyHash = await sha256(rawKey);

    // Look up by prefix (fast index lookup) then verify hash
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, user_id, key_hash, rate_limit_rpm, is_revoked")
      .eq("key_prefix", keyPrefix)
      .limit(10);

    if (error) {
      log.error("API key lookup failed", { error: error.message });
      return { authenticated: false, error: "Authentication service error" };
    }

    if (!data || data.length === 0) {
      return { authenticated: false, error: "Invalid API key" };
    }

    // Find the matching key by hash
    const matchingKey = data.find((k) => {
      const expected = Buffer.from(k.key_hash, "hex");
      const actual = Buffer.from(keyHash, "hex");
      return (
        expected.length === actual.length && timingSafeEqual(expected, actual)
      );
    });
    if (!matchingKey) {
      return { authenticated: false, error: "Invalid API key" };
    }

    if (matchingKey.is_revoked) {
      return { authenticated: false, error: "API key has been revoked" };
    }

    void Promise.resolve(
      supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", matchingKey.id),
    )
      .then(({ error: usageError }) => {
        if (usageError) {
          log.warn("API key usage update failed", {
            keyId: matchingKey.id,
            error: usageError.message,
          });
        }
      })
      .catch((error: unknown) => {
        log.warn("API key usage update failed", {
          keyId: matchingKey.id,
          error: error instanceof Error ? error.message : "Unknown",
        });
      });

    return {
      authenticated: true,
      authMethod: "api-key",
      userId: matchingKey.user_id,
      keyId: matchingKey.id,
      rateLimitRpm: matchingKey.rate_limit_rpm,
    };
  } catch (error) {
    log.error("API key validation error", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return { authenticated: false, error: "Authentication service error" };
  }
}

/**
 * Generate a new API key.
 * Returns the raw key (show to user once) and the hash (store in DB).
 */
export async function generateApiKey(): Promise<{
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
}> {
  // Generate 32 random bytes as hex
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const rawKey = `mr_live_${hex}`;
  const keyPrefix = rawKey.substring(0, 16);
  const keyHash = await sha256(rawKey);

  return { rawKey, keyHash, keyPrefix };
}
