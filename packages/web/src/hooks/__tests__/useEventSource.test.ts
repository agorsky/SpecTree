/**
 * Unit Tests: useEventSource hook (ENG-60)
 *
 * Tests the useEventSource hook with mocked EventSource:
 * - Creates EventSource connection on mount with correct URL
 * - Updates status on connection events (connecting -> connected)
 * - Parses and exposes events via lastEvent
 * - Implements exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)
 * - Calls EventSource.close() on unmount
 * - Clears timers on unmount to prevent memory leaks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEventSource } from "../useEventSource";

// Mock the auth store
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { accessToken: "test-token-123" };
    return selector ? selector(state) : state;
  }),
}));

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0; // CONNECTING
  
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  
  close = vi.fn();
  
  // Helper methods for testing
  _triggerOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }
  
  _triggerMessage(data: unknown) {
    if (this.onmessage) {
      const event = new MessageEvent("message", {
        data: JSON.stringify(data),
      });
      this.onmessage(event);
    }
  }
  
  _triggerError() {
    this.readyState = 2; // CLOSED
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
  
  static reset() {
    MockEventSource.instances = [];
  }
}

// Store original EventSource
const OriginalEventSource = globalThis.EventSource;

describe("useEventSource", () => {
  beforeEach(() => {
    // Install mock
    globalThis.EventSource = MockEventSource as any;
    MockEventSource.reset();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    // Restore original
    globalThis.EventSource = OriginalEventSource;
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  
  describe("connection establishment", () => {
    it("creates EventSource on mount when enabled=true", () => {
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.instances[0]!.url).toContain("/api/v1/events");
      expect(MockEventSource.instances[0]!.url).toContain("token=test-token-123");
    });
    
    it("includes epicId in URL when provided", () => {
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          epicId: "epic-123",
          enabled: true,
        })
      );
      
      expect(MockEventSource.instances[0]!.url).toContain("epicId=epic-123");
    });
    
    it("does not create EventSource when enabled=false", () => {
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: false,
        })
      );
      
      expect(MockEventSource.instances).toHaveLength(0);
    });
  });
  
  describe("status updates", () => {
    it("starts with 'disconnected' status when disabled", () => {
      const { result } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: false,
        })
      );
      
      expect(result.current.status).toBe("disconnected");
    });
    
    it("updates to 'connecting' when connection starts", () => {
      const { result } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // Status should be connecting after mount
      expect(result.current.status).toBe("connecting");
    });
    
    it("updates to 'connected' on successful connection", () => {
      const { result } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // Trigger successful connection
      act(() => {
        MockEventSource.instances[0]!._triggerOpen();
      });
      
      expect(result.current.status).toBe("connected");
    });
    
    it("updates to 'disconnected' on error", () => {
      const { result } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // Trigger error
      act(() => {
        MockEventSource.instances[0]!._triggerError();
      });
      
      expect(result.current.status).toBe("disconnected");
    });
  });
  
  describe("event parsing", () => {
    it("parses JSON events and updates lastEvent", () => {
      const { result } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // Trigger message
      const testData = { entityType: "feature", entityId: "123" };
      act(() => {
        MockEventSource.instances[0]!._triggerMessage(testData);
      });
      
      expect(result.current.lastEvent).toBeTruthy();
      expect(result.current.lastEvent?.data).toEqual(testData);
      expect(result.current.lastEvent?.timestamp).toBeTruthy();
    });
    
    it("calls onEvent callback when event is received", () => {
      const onEvent = vi.fn();
      
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
          onEvent,
        })
      );
      
      // Trigger message
      const testData = { test: "data" };
      act(() => {
        MockEventSource.instances[0]!._triggerMessage(testData);
      });
      
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: testData,
        })
      );
    });
  });
  
  describe("exponential backoff reconnection", () => {
    it("reconnects after 1s on first error", () => {
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // Trigger error
      act(() => {
        MockEventSource.instances[0]!._triggerError();
      });
      
      expect(MockEventSource.instances).toHaveLength(1);
      
      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      // Should create new connection
      expect(MockEventSource.instances).toHaveLength(2);
    });
    
    it("doubles backoff delay after each error", () => {
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // First error
      act(() => {
        MockEventSource.instances[0]!._triggerError();
        vi.advanceTimersByTime(1000); // 1s delay
      });
      expect(MockEventSource.instances).toHaveLength(2);
      
      // Second error
      act(() => {
        MockEventSource.instances[1]!._triggerError();
        vi.advanceTimersByTime(2000); // 2s delay
      });
      expect(MockEventSource.instances).toHaveLength(3);
      
      // Third error
      act(() => {
        MockEventSource.instances[2]!._triggerError();
        vi.advanceTimersByTime(4000); // 4s delay
      });
      expect(MockEventSource.instances).toHaveLength(4);
    });
    
    it("caps backoff at 30 seconds", () => {
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // Trigger many errors to exceed 30s cap
      // 1s -> 2s -> 4s -> 8s -> 16s -> 32s (should cap at 30s)
      const delays = [1000, 2000, 4000, 8000, 16000, 30000];
      
      for (let i = 0; i < delays.length; i++) {
        act(() => {
          MockEventSource.instances[i]!._triggerError();
          vi.advanceTimersByTime(delays[i]!);
        });
      }
      
      expect(MockEventSource.instances).toHaveLength(delays.length + 1);
    });
    
    it("resets backoff on successful connection", () => {
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // First error - 1s backoff
      act(() => {
        MockEventSource.instances[0]!._triggerError();
        vi.advanceTimersByTime(1000);
      });
      
      // Successful connection - should reset backoff
      act(() => {
        MockEventSource.instances[1]!._triggerOpen();
      });
      
      // Another error - should use 1s backoff again (not 2s)
      act(() => {
        MockEventSource.instances[1]!._triggerError();
        vi.advanceTimersByTime(1000);
      });
      
      expect(MockEventSource.instances).toHaveLength(3);
    });
  });
  
  describe("cleanup", () => {
    it("calls close() on unmount", () => {
      const { unmount } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      const es = MockEventSource.instances[0]!;
      
      unmount();
      
      expect(es.close).toHaveBeenCalled();
    });
    
    it("clears reconnection timers on unmount", () => {
      const { unmount } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
        })
      );
      
      // Trigger error to schedule reconnection
      act(() => {
        MockEventSource.instances[0]!._triggerError();
      });
      
      // Unmount before timer fires
      unmount();
      
      // Advance timers - should not create new connection
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      expect(MockEventSource.instances).toHaveLength(1);
    });
    
    it("calls onClose callback on cleanup", () => {
      const onClose = vi.fn();
      
      const { unmount } = renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
          onClose,
        })
      );
      
      unmount();
      
      expect(onClose).toHaveBeenCalled();
    });
  });
  
  describe("callbacks", () => {
    it("calls onOpen when connection opens", () => {
      const onOpen = vi.fn();
      
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
          onOpen,
        })
      );
      
      act(() => {
        MockEventSource.instances[0]!._triggerOpen();
      });
      
      expect(onOpen).toHaveBeenCalled();
    });
    
    it("calls onError when connection fails", () => {
      const onError = vi.fn();
      
      renderHook(() =>
        useEventSource({
          url: "/api/v1/events",
          enabled: true,
          onError,
        })
      );
      
      act(() => {
        MockEventSource.instances[0]!._triggerError();
      });
      
      expect(onError).toHaveBeenCalled();
    });
  });
});
