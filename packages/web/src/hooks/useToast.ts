import { useState, useCallback, useEffect } from "react";

export interface Toast {
  id: string;
  message: string;
  duration?: number;
}

let toastCounter = 0;

// Global toast manager
let globalToasts: Toast[] = [];
let globalListeners: Set<(toasts: Toast[]) => void> = new Set();

function notifyListeners() {
  globalListeners.forEach((listener) => listener([...globalToasts]));
}

function addToast(message: string, duration = 3000) {
  const id = `toast-${++toastCounter}`;
  const toast: Toast = { id, message, duration };
  globalToasts = [...globalToasts, toast];
  notifyListeners();

  // Auto-remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);

  return id;
}

function removeToast(id: string) {
  globalToasts = globalToasts.filter((t) => t.id !== id);
  notifyListeners();
}

/**
 * Hook to show toast notifications
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  useEffect(() => {
    const listener = (updatedToasts: Toast[]) => {
      setToasts(updatedToasts);
    };
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  const toast = useCallback((message: string, duration?: number) => {
    return addToast(message, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, []);

  return { toast, dismiss, toasts };
}
