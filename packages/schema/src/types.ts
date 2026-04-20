export type EventType = 'track' | 'identify' | 'error';

export interface EventContext {
  viewport: string;
  url: string;
  sessionId: string;
  appVersion: string;
  timestamp: number;
  ip?: string;
  userAgent?: string;
  country?: string;
}

export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
}

export interface BatchedEvent {
  type: EventType;
  event?: string;
  userId?: string;
  properties?: Record<string, unknown>;
  traits?: Record<string, unknown>;
  error?: SerializedError;
  context: EventContext;
}

export interface IngestBatch {
  batch: BatchedEvent[];
}
