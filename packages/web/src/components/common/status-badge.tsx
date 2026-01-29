import { cn } from "@/lib/utils";
import type { Status } from "@/lib/api/types";

const categoryColors: Record<Status["category"], string> = {
  backlog: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  unstarted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  started: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        categoryColors[status.category],
        className
      )}
    >
      {status.name}
    </span>
  );
}
