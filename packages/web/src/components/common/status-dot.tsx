import { cn } from "@/lib/utils";
import type { Status } from "@/lib/api/types";

const categoryColors: Record<Status["category"], string> = {
  backlog: "bg-gray-400",
  unstarted: "bg-blue-500",
  started: "bg-yellow-500",
  completed: "bg-green-500",
  canceled: "bg-red-500",
};

interface StatusDotProps {
  status: Status;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full flex-shrink-0",
        categoryColors[status.category],
        className
      )}
      title={status.name}
    />
  );
}
