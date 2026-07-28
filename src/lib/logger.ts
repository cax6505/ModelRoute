/**
 * Structured JSON logger with correlation ID support.
 *
 * Every log line is a JSON object with:
 * - timestamp, level, message
 * - correlationId (flows through the full request lifecycle)
 * - component (which subsystem emitted the log)
 * - Optional structured data (never raw prompts or secrets)
 *
 * SECURITY: Never log API keys, raw prompt text, or PII.
 * Use promptHash and metadata instead.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  component?: string;
  userId?: string;
  provider?: string;
  model?: string;
  taskType?: string;
  latencyMs?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  component?: string;
  data?: Record<string, unknown>;
}

class StructuredLogger {
  private defaultContext: LogContext;

  constructor(defaultContext: LogContext = {}) {
    this.defaultContext = defaultContext;
  }

  /**
   * Create a child logger with additional default context.
   * Useful for adding correlationId to all logs within a request.
   */
  child(context: LogContext): StructuredLogger {
    return new StructuredLogger({ ...this.defaultContext, ...context });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.defaultContext.correlationId,
      component: this.defaultContext.component,
      data: data
        ? this.sanitize({ ...this.defaultContext, ...data })
        : this.sanitize(this.defaultContext),
    };

    // Remove undefined values for cleaner output
    const cleaned = JSON.parse(
      JSON.stringify(entry, (_key, value) => (value === undefined ? undefined : value)),
    );

    const output = JSON.stringify(cleaned);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Strip any keys that might contain secrets before logging.
   * This is a defense-in-depth measure — callers should also
   * never pass secrets, but this catches mistakes.
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const REDACTED_KEYS = [
      'apiKey', 'api_key', 'apikey',
      'secret', 'password', 'token',
      'authorization', 'cookie',
      'promptText', 'prompt_text', 'rawPrompt',
      'responseText', 'response_text', 'rawResponse',
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (REDACTED_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

/** Root logger instance — create child loggers for request-scoped logging */
export const logger = new StructuredLogger({ component: 'modelroute' });

/**
 * Generate a unique correlation ID for request tracing.
 * Format: mr_<timestamp_hex>_<random_hex>
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `mr_${timestamp}_${random}`;
}
