import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client factory.
 *
 * Two clients:
 * 1. `supabaseAdmin` — uses service role key, bypasses RLS.
 *    Only for server-side admin operations (inserting logs, validating API keys).
 * 2. `createSupabaseClient()` — creates RLS-respecting client.
 *    Used for user-scoped data access.
 *
 * SECURITY: Service role key is never exposed to the client.
 * The admin client is only used in server-side code.
 */

let adminClient: SupabaseClient | null = null;

/**
 * Get the admin Supabase client (service role, bypasses RLS).
 * Lazy-initialized to avoid crashing during build when env vars aren't available.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client',
      );
    }

    adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

/**
 * Create an RLS-respecting Supabase client for user-scoped operations.
 * Pass the user's JWT to scope queries to their data.
 */
export function createSupabaseClient(accessToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return createClient(url, anonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

/**
 * Hash a string using SHA-256.
 * Used for prompt hashing (privacy) and API key storage.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
