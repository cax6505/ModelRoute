import { NextRequest } from 'next/server';
import { generateApiKey, validateApiKey } from '@/lib/middleware/auth';
import { CreateApiKeySchema, createApiError } from '@/lib/schemas';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request.headers.get('authorization'));
    if (!auth.authenticated && process.env.NODE_ENV === 'production') {
      return createApiError('UNAUTHORIZED', auth.error || 'Invalid API key', 401);
    }
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('api_keys')
      .select('id, name, key_prefix, rate_limit_rpm, is_revoked, last_used_at, created_at');
    if (auth.userId) query = query.eq('user_id', auth.userId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return Response.json({ keys: [] });
    }

    return Response.json({ keys: data ?? [] });
  } catch {
    return createApiError('INTERNAL_ERROR', 'Failed to fetch API keys', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiKey(request.headers.get('authorization'));
    if (!auth.authenticated && process.env.NODE_ENV === 'production') {
      return createApiError('UNAUTHORIZED', auth.error || 'Invalid API key', 401);
    }
    const body = await request.json();
    const parseResult = CreateApiKeySchema.safeParse(body);

    if (!parseResult.success) {
      return createApiError('VALIDATION_ERROR', 'Invalid key parameters', 400);
    }

    const { name, rateLimitRpm } = parseResult.data;
    const { rawKey, keyHash, keyPrefix } = await generateApiKey();

    const supabase = getSupabaseAdmin();
    const userId = auth.userId ?? '00000000-0000-0000-0000-000000000000';

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
  } catch {
    return createApiError('INTERNAL_ERROR', 'Failed to create API key', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await validateApiKey(request.headers.get('authorization'));
    if (!auth.authenticated && process.env.NODE_ENV === 'production') {
      return createApiError('UNAUTHORIZED', auth.error || 'Invalid API key', 401);
    }
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return createApiError('VALIDATION_ERROR', 'Key id is required', 400);
    const supabase = getSupabaseAdmin();
    let query = supabase.from('api_keys').update({ is_revoked: true }).eq('id', id);
    if (auth.userId) query = query.eq('user_id', auth.userId);
    const { error } = await query;
    if (error) return createApiError('NOT_FOUND', 'API key not found', 404);
    return Response.json({ revoked: true, id });
  } catch {
    return createApiError('INTERNAL_ERROR', 'Failed to revoke API key', 500);
  }
}
