/**
 * Event History Manager
 *
 * Manages a circular buffer of events per epicId.
 * Retains the last 200 events per epic to prevent memory leaks.
 */

interface StoredEvent {
  id: string;
  type: string;
  data: unknown;
  timestamp: string;
}

class EventHistory {
  private eventBuffer: Map<string, StoredEvent[]>;
  private readonly MAX_EVENTS_PER_EPIC = 200;
  private eventIdCounters: Map<string, number>; // Counter per epic

  constructor() {
    this.eventBuffer = new Map();
    this.eventIdCounters = new Map();
  }

  /**
   * Generate a unique event ID for a specific epic
   */
  private generateEventId(epicId: string): string {
    // Get or initialize counter for this epic
    const currentCount = this.eventIdCounters.get(epicId) ?? 0;
    const nextCount = currentCount + 1;
    this.eventIdCounters.set(epicId, nextCount);
    
    // Format: {epicId}:{counter}
    return `${epicId}:${nextCount}`;
  }

  /**
   * Add an event to the history buffer for a specific epic
   */
  addEvent(epicId: string, type: string, data: unknown): string {
    const eventId = this.generateEventId(epicId);
    const event: StoredEvent = {
      id: eventId,
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    // Get or create the buffer for this epic
    let events = this.eventBuffer.get(epicId);
    if (!events) {
      events = [];
      this.eventBuffer.set(epicId, events);
    }

    // Add the event
    events.push(event);

    // If buffer exceeds max size, remove oldest events
    if (events.length > this.MAX_EVENTS_PER_EPIC) {
      events.splice(0, events.length - this.MAX_EVENTS_PER_EPIC);
    }

    return eventId;
  }

  /**
   * Get all events for a specific epic
   */
  getEvents(epicId: string): StoredEvent[] {
    return this.eventBuffer.get(epicId) ?? [];
  }

  /**
   * Get events after a specific event ID for replay on reconnect
   */
  getEventsAfter(epicId: string, lastEventId: string): StoredEvent[] {
    const events = this.eventBuffer.get(epicId) ?? [];
    const lastEventIndex = events.findIndex((e) => e.id === lastEventId);
    
    // If event not found, return all events (full catchup)
    if (lastEventIndex === -1) {
      return events;
    }
    
    // Return events after the last event ID
    return events.slice(lastEventIndex + 1);
  }

  /**
   * Get recent events for a specific epic (limited count)
   */
  getRecentEvents(epicId: string, limit: number = 50): StoredEvent[] {
    const events = this.eventBuffer.get(epicId) ?? [];
    return events.slice(-limit);
  }

  /**
   * Clear all events for a specific epic
   */
  clearEpic(epicId: string): void {
    this.eventBuffer.delete(epicId);
    this.eventIdCounters.delete(epicId);
  }

  /**
   * Clear all events
   */
  clearAll(): void {
    this.eventBuffer.clear();
    this.eventIdCounters.clear();
  }

  /**
   * Get statistics about the event buffer
   */
  getStats(): { epicCount: number; totalEvents: number } {
    let totalEvents = 0;
    for (const events of this.eventBuffer.values()) {
      totalEvents += events.length;
    }
    return {
      epicCount: this.eventBuffer.size,
      totalEvents,
    };
  }
}

// Singleton instance
export const eventHistory = new EventHistory();
