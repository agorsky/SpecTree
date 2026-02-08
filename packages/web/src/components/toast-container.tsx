import { useToast } from "@/hooks/useToast";

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="
            bg-gray-900 dark:bg-gray-800 
            text-white text-sm 
            px-4 py-3 rounded-lg 
            shadow-lg 
            animate-slide-up 
            pointer-events-auto 
            max-w-md
            transition-all duration-200
            cursor-pointer
            hover:bg-gray-800 dark:hover:bg-gray-700
          "
          role="status"
          onClick={() => dismiss(toast.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              dismiss(toast.id);
            }
          }}
          tabIndex={0}
          aria-label={`Notification: ${toast.message}. Click to dismiss.`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
