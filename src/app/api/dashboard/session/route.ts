import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  validateRequestAuth,
} from "@/lib/middleware/auth";
import { createApiError } from "@/lib/schemas";

export const dynamic = "force-dynamic";

function matchesConfiguredKey(value: string): boolean {
  const configuredKey = process.env.MODELROUTE_DASHBOARD_API_KEY;
  if (!configuredKey) return false;
  const expected = Buffer.from(configuredKey);
  const actual = Buffer.from(value);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

export async function GET(request: NextRequest) {
  const auth = await validateRequestAuth(request);
  return Response.json(
    { authenticated: auth.authenticated },
    { status: auth.authenticated ? 200 : 401 },
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
  } | null;
  if (typeof body?.key !== "string" || !matchesConfiguredKey(body.key)) {
    return createApiError("UNAUTHORIZED", "Invalid dashboard credential", 401);
  }

  const response = Response.json({ authenticated: true });
  response.headers.append(
    "Set-Cookie",
    `${DASHBOARD_SESSION_COOKIE}=${encodeURIComponent(body.key)}; Path=/; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return response;
}

