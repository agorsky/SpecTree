import { ConnectionStatus } from "@/hooks/useEventSource";
import { useLiveUpdatesStatus } from "@/providers/LiveUpdatesProvider";

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; label: string; pulse: boolean; shadowClass: string }
> = {
  connected: {
    color: "bg-green-500",
    label: "Live",
    pulse: true,
    shadowClass: "shadow-sm shadow-green-500/50",
  },
  connecting: {
    color: "bg-yellow-500",
    label: "Reconnecting...",
    pulse: false,
    shadowClass: "",
  },
  disconnected: {
    color: "bg-red-500",
    label: "Offline",
    pulse: false,
    shadowClass: "",
  },
};

export function LiveIndicator() {
  const status = useLiveUpdatesStatus();
  const config = STATUS_CONFIG[status];

  return (
    <div
      className="flex items-center gap-1.5 transition-opacity duration-300"
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${config.label}`}
    >
      <span
        className={`
          h-2 w-2 rounded-full transition-colors duration-300
          ${config.color}
          ${config.pulse ? "animate-pulse" : ""}
          ${config.shadowClass}
        `}
        aria-hidden="true"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium transition-colors duration-300">
        {config.label}
      </span>
    </div>
  );
}
