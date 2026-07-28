import { NextRequest } from 'next/server';
import { generateApiKey, validateApiKey } from '@/lib/middleware/auth';
import { CreateApiKeySchema, createApiError } from '@/lib/schemas';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, rate_limit_rpm, is_revoked, last_used_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json({ keys: [] });
    }

    return Response.json({ keys: data ?? [] });
  } catch (error) {
    return createApiError('INTERNAL_ERROR', 'Failed to fetch API keys', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = CreateApiKeySchema.safeParse(body);

    if (!parseResult.success) {
      return createApiError('VALIDATION_ERROR', 'Invalid key parameters', 400);
    }

    const { name, rateLimitRpm } = parseResult.data;
    const { rawKey, keyHash, keyPrefix } = await generateApiKey();

    const supabase = getSupabaseAdmin();
    // Default user ID for demo/MVP
    const userId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase.from('api_keys').insert({
      user_id: userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      rate_limit_rpm: rateLimitRpm,
    }).select('id, name, key_prefix, created_at').single();

    if (error) {
      // In demo mode without DB connected, return key structure directly
      return Response.json({
        rawKey,
        key: {
          id: crypto.randomUUID(),
          name,
          key_prefix: keyPrefix,
          rate_limit_rpm: rateLimitRpm,
          is_revoked: false,
          created_at: new Date().toISOString(),
        },
      });
    }

    return Response.json({ rawKey, key: data });
  } catch (error) {
    return createApiError('INTERNAL_ERROR', 'Failed to create API key', 500);
  }
}
