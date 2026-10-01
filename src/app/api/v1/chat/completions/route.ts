import { NextRequest } from "next/server";
import { POST as routePrompt } from "@/app/api/route/route";
import { createApiError } from "@/lib/schemas";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ChatCompletionSchema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
  stream: z.boolean().optional().default(false),
  priority: z.enum(["fast", "quality", "cheap"]).optional().default("quality"),
  idempotency_key: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = ChatCompletionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return createApiError(
      "VALIDATION_ERROR",
      "Invalid chat completion request",
      400,
      {
        issues: parsed.error.issues,
      },
    );
  }

  const prompt = parsed.data.messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  const upstreamRequest = new NextRequest(new URL("/api/route", request.url), {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      priority: parsed.data.priority,
      stream: false,
      idempotencyKey: parsed.data.idempotency_key,
    }),
  });
  const upstream = await routePrompt(upstreamRequest);

  if (parsed.data.stream) {
    if (!upstream.ok || !upstream.body) {
      return upstream;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    let model = parsed.data.model ?? "unknown";
    let finished = false;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          if (!finished) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const dataLine = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const data = dataLine.slice(6);
          try {
            const payload = JSON.parse(data) as {
              type?: string;
              content?: string;
              model?: string;
              actualModel?: string;
              error?: string;
            };
            if (payload.model || payload.actualModel) {
              model = payload.model ?? payload.actualModel ?? model;
            }
            if (payload.type === "routing_decision") continue;
            if (payload.type === "error") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: { message: payload.error ?? "Stream failed", type: "server_error" } })}\n\n`,
                ),
              );
              finished = true;
              continue;
            }
            if (payload.type === "done") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ id: `chatcmpl_${crypto.randomUUID()}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`,
                ),
              );
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              finished = true;
              continue;
            }
            if (payload.content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ id: `chatcmpl_${crypto.randomUUID()}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: payload.content }, finish_reason: null }] })}\n\n`,
                ),
              );
            }
          } catch {
            continue;
          }
        }
      },
      cancel() {
        void reader.cancel();
      },
    });

    return new Response(stream, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Correlation-ID": upstream.headers.get("X-Correlation-ID") ?? "",
      },
    });
  }
  const payload = await upstream.json().catch(() => null);

  if (!upstream.ok || !payload?.content) {
    return Response.json(payload ?? { error: "Completion failed" }, {
      status: upstream.status,
      headers: upstream.headers,
    });
  }

  const decision = payload.routingDecision;
  return Response.json(
    {
      id: `chatcmpl_${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: parsed.data.model ?? decision.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: payload.content },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: decision.inputTokens ?? 0,
        completion_tokens: decision.outputTokens ?? 0,
        total_tokens:
          (decision.inputTokens ?? 0) + (decision.outputTokens ?? 0),
      },
      modelroute: { routingDecision: decision },
    },
    {
      headers: {
        "X-Correlation-ID": upstream.headers.get("X-Correlation-ID") ?? "",
      },
    },
  );
}
