import { CalleClient, CalleAPIError } from "@call-e/calle";
import type { Call } from "@call-e/calle";
import { ProviderError, type CallProvider, type CreateCallInput, type ProviderCall } from "./provider";

function map(c: Call): ProviderCall {
  return {
    id: c.id,
    status: c.status,
    callOutcome: c.callOutcome ?? null,
    resultStatus: c.resultStatus,
    transcript: (c.transcript ?? []).map((t) => ({ offset_seconds: t.offset_seconds ?? null, speaker: String(t.speaker), text: t.text })),
    result: (c.result as Record<string, string | number | boolean> | null) ?? null,
    error: c.error ? { code: c.error.code, message: c.error.message } : null,
    locale: c.locale,
    metadata: c.metadata ?? {},
    createdAt: c.createdAt,
    completedAt: c.completedAt,
  };
}

export class LiveCalleProvider implements CallProvider {
  readonly mode = "live" as const;
  private client: CalleClient;
  constructor(apiKey: string) {
    this.client = new CalleClient({ apiKey });
  }
  async create(input: CreateCallInput, idempotencyKey: string): Promise<ProviderCall> {
    try {
      const c = await this.client.calls.create(
        {
          task: input.task,
          phone: input.phone,
          ...(input.locale ? { locale: input.locale } : {}),
          ...(input.region ? { region: input.region } : {}),
          resultSchema: input.resultSchema,
          metadata: input.metadata,
          ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
        },
        { idempotencyKey },
      );
      return map(c);
    } catch (e) {
      if (e instanceof CalleAPIError) throw new ProviderError(e.code, e.message, e.status, (e as unknown as { details?: unknown }).details);
      throw new ProviderError("transport", e instanceof Error ? e.message : String(e));
    }
  }
  async get(id: string): Promise<ProviderCall> {
    try {
      return map(await this.client.calls.get(id));
    } catch (e) {
      if (e instanceof CalleAPIError) throw new ProviderError(e.code, e.message, e.status);
      throw new ProviderError("transport", e instanceof Error ? e.message : String(e));
    }
  }
}
