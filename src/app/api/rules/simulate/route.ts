import { NextRequest } from "next/server";
import { classify } from "@/lib/core/classifier";
import { selectRoute } from "@/lib/core/router";
import { circuitBreaker } from "@/lib/core/circuit-breaker";
import { createApiError } from "@/lib/schemas";
import { validateRequestAuth } from "@/lib/middleware/auth";
import { getSupabaseAdmin } from "@/lib/db/client";
import type { PriorityMode, RoutingRule } from "@/lib/core/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SimulationSchema = z.object({
  prompt: z.string().min(1).max(100_000),
  priority: z.enum(["fast", "quality", "cheap"]).default("quality"),
});

export async function POST(request: NextRequest) {
  const auth = await validateRequestAuth(request);
  if (!auth.authenticated && process.env.NODE_ENV === "production") {
    return createApiError("UNAUTHORIZED", "Invalid API key", 401);
  }

  const parsed = SimulationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return createApiError(
      "VALIDATION_ERROR",
      "A prompt and valid priority are required",
      400,
    );
  }

  const { prompt, priority } = parsed.data;
  const classification = await classify(prompt, "rules");
  let customRules: RoutingRule[] | undefined;

  try {
    const supabase = getSupabaseAdmin();
    const query = supabase
      .from("routing_rules")
      .select("id, user_id, task_type, priority_mode, candidates, is_active")
      .eq("is_active", true)
      .or(
        auth.userId
          ? `user_id.is.null,user_id.eq.${auth.userId}`
          : "user_id.is.null",
      );
    const { data } = await query;
    customRules = (data ?? []).map((rule) => ({
      id: rule.id,
      userId: rule.user_id,
      taskType: rule.task_type,
      priorityMode: rule.priority_mode,
      candidates: rule.candidates,
      isActive: rule.is_active,
    })) as RoutingRule[];
  } catch {
    customRules = undefined;
  }

  const decision = selectRoute({
    classification,
    priority: priority as PriorityMode,
    customRules,
    breaker: circuitBreaker,
  });

  return Response.json({
    classification,
    decision,
    simulated: true,
    executed: false,
  });
}
