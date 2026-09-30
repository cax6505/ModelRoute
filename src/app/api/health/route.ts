import { circuitBreaker } from '@/lib/core/circuit-breaker';
import { providerRegistry } from '@/lib/providers/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = await Promise.all(
    providerRegistry.getAvailableProviders().map(async (provider) => {
      const health = await provider.healthCheck();
      const circuit = circuitBreaker.getStatus(provider.name);
      return {
        name: provider.name,
        available: health.available,
        latencyMs: health.latencyMs ?? null,
        errorMessage: health.available ? null : health.errorMessage ?? 'Unavailable',
        circuitState: circuit.state,
        failureCount: circuit.failureCount,
      };
    }),
  );

  return Response.json({ providers, generatedAt: new Date().toISOString() });
}