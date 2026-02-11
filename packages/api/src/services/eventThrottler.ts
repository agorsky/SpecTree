/**
 * Event Throttler
 * 
 * Provides throttling and batching for session events to prevent overwhelming SSE clients.
 * Features:
 * - Max 10 events/second throttling using a token bucket algorithm
 * - Batching for rapid-fire task completion events (500ms window)
 * - Priority handling for SESSION_ERROR events (bypass throttle)
 * - Queue size limit to prevent memory leaks (max 200 events)
 */

import { EventEmitter } from "events";
import type { SessionEvent } from "@spectree/shared";
import { SessionEventType } from "@spectree/shared";

// Throttling configuration
const MAX_EVENTS_PER_SECOND = 10;
const REFILL_INTERVAL_MS = 100; // Refill tokens every 100ms
const TOKENS_PER_REFILL = (MAX_EVENTS_PER_SECOND * REFILL_INTERVAL_MS) / 1000; // 1 token per 100ms

// Batching configuration
const BATCH_WINDOW_MS = 500;
const MAX_QUEUE_SIZE = 200;

// Batchable event types
const BATCHABLE_EVENT_TYPES = new Set([
  SessionEventType.SESSION_TASK_COMPLETED,
  SessionEventType.SESSION_TASK_STARTED,
]);

interface QueuedEvent {
  event: SessionEvent;
  priority: boolean; // If true, bypass throttle
}

/**
 * Event Throttler class
 */
export class EventThrottler extends EventEmitter {
  private queue: QueuedEvent[] = [];
  private tokens: number = MAX_EVENTS_PER_SECOND;
  private refillTimer: NodeJS.Timeout | null = null;
  private processTimer: NodeJS.Timeout | null = null;
  private batchTimer: NodeJS.Timeout | null = null;
  private batchedEvents: Map<string, SessionEvent[]> = new Map();

  constructor() {
    super();
    this.startRefill();
    this.startProcessing();
  }

  /**
   * Enqueue an event (may be queued/batched)
   */
  enqueue(event: SessionEvent): void {
    // Priority events bypass throttling and batching
    const isPriority = event.eventType === SessionEventType.SESSION_ERROR;

    if (isPriority) {
      this.emitImmediate(event);
      return;
    }

    // Check if event is batchable
    if (this.isBatchable(event)) {
      this.addToBatch(event);
      return;
    }

    // Check queue size to prevent memory leaks
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn(`[EventThrottler] Queue full (${MAX_QUEUE_SIZE}), dropping event:`, event.eventType);
      return;
    }

    // Add to queue
    this.queue.push({ event, priority: false });
  }

  /**
   * Emit an event immediately without throttling
   */
  private emitImmediate(event: SessionEvent): void {
    super.emit("event", event);
  }

  /**
   * Check if an event type is batchable
   */
  private isBatchable(event: SessionEvent): boolean {
    return BATCHABLE_EVENT_TYPES.has(event.eventType);
  }

  /**
   * Add an event to the batch
   */
  private addToBatch(event: SessionEvent): void {
    const batchKey = `${event.epicId}:${event.eventType}`;
    
    if (!this.batchedEvents.has(batchKey)) {
      this.batchedEvents.set(batchKey, []);
    }
    
    this.batchedEvents.get(batchKey)!.push(event);

    // Start batch timer if not running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatches();
      }, BATCH_WINDOW_MS);
    }
  }

  /**
   * Flush all batched events
   */
  private flushBatches(): void {
    this.batchTimer = null;

    for (const [, events] of this.batchedEvents.entries()) {
      if (events.length === 0) continue;

      // If only one event, emit it directly
      if (events.length === 1) {
        this.queue.push({ event: events[0]!, priority: false });
      } else {
        // Create a batch event (use the first event as template)
        const batchEvent: SessionEvent = {
          ...events[0]!,
          metadata: {
            batch: true,
            count: events.length,
            eventIds: events.map(e => e.sessionId),
          },
        };
        this.queue.push({ event: batchEvent, priority: false });
      }
    }

    this.batchedEvents.clear();
  }

  /**
   * Refill tokens at regular intervals
   */
  private startRefill(): void {
    this.refillTimer = setInterval(() => {
      // Add tokens up to max
      this.tokens = Math.min(MAX_EVENTS_PER_SECOND, this.tokens + TOKENS_PER_REFILL);
    }, REFILL_INTERVAL_MS);
  }

  /**
   * Process queued events using available tokens
   */
  private startProcessing(): void {
    this.processTimer = setInterval(() => {
      while (this.queue.length > 0 && this.tokens >= 1) {
        const queued = this.queue.shift();
        if (!queued) break;

        // Emit the event
        super.emit("event", queued.event);

        // Consume a token (unless priority)
        if (!queued.priority) {
          this.tokens -= 1;
        }
      }
    }, 50); // Process every 50ms
  }

  /**
   * Stop the throttler and clean up timers
   */
  stop(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    // Flush any remaining batched events
    this.flushBatches();
  }

  /**
   * Get current queue length (for monitoring/testing)
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get current token count (for monitoring/testing)
   */
  getTokenCount(): number {
    return this.tokens;
  }
}

// Singleton instance
export const sessionEventThrottler = new EventThrottler();
