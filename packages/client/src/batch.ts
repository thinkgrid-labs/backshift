import type { BatchedEvent, BatchQueueOptions } from './types.js';

export class BatchQueue {
  private events: BatchedEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private readonly options: BatchQueueOptions;
  private readonly handleVisibility: () => void;

  constructor(options: BatchQueueOptions) {
    this.options = options;
    this.handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        this.flushSync();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  push(event: BatchedEvent): void {
    this.events.push(event);
    if (this.events.length >= this.options.maxSize) {
      this.flush();
      return;
    }
    if (!this.timer) {
      this.startTimer();
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.events.length === 0 || this.flushing) return;

    this.flushing = true;
    const batch = this.events.splice(0);
    try {
      await this.options.onFlush(batch);
    } finally {
      this.flushing = false;
    }
  }

  /** Synchronous drain used on visibilitychange — does not await. */
  flushSync(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.events.length === 0) return;
    const batch = this.events.splice(0);
    void this.options.onFlush(batch);
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }

  private startTimer(): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.flushInterval);
  }
}
