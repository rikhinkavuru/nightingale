/**
 * Transport-neutral call provider. The live adapter wraps the official
 * @call-e/calle SDK (v2 single-call API). The fake provider produces the same
 * shapes synchronously so the whole product runs without placing a call.
 */
export interface CreateCallInput {
  task: string;
  phone: string;
  locale?: string | null;
  region?: string | null;
  resultSchema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  webhookUrl?: string;
}

export interface TranscriptTurn {
  offset_seconds: number | null;
  speaker: string;
  text: string;
}

export interface ProviderCall {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "canceled";
  callOutcome: "completed" | "no_answer" | "busy" | "declined" | null;
  resultStatus: "pending" | "available" | "unavailable" | "not_applicable";
  transcript: TranscriptTurn[];
  result: Record<string, string | number | boolean> | null;
  error: { code: string; message: string } | null;
  locale: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

export interface CallProvider {
  readonly mode: "dry" | "live";
  create(input: CreateCallInput, idempotencyKey: string): Promise<ProviderCall>;
  get(id: string): Promise<ProviderCall>;
}

export class ProviderError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number, public readonly details?: unknown) {
    super(message);
  }
}

export const maskPhone = (p: string) => p.replace(/\d(?=\d{4})/g, "•");

/** Rough cost from the CALL-E billing page: ~$0.04/min carrier + ~$0.18/min model for one-shot calls. */
export const estimateCostUsd = (seconds: number) => Math.ceil(seconds / 60) * 0.04 + Math.ceil(seconds / 10) * 0.0296;
