import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStatuses } from "@/hooks/queries/use-statuses";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  backlog: "bg-gray-400",
  unstarted: "bg-blue-400",
  started: "bg-yellow-400",
  completed: "bg-green-400",
  canceled: "bg-red-400",
};

interface StatusSelectProps {
  teamId?: string | undefined;
  value?: string | undefined;
  onChange: (statusId: string | undefined) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  allowClear?: boolean | undefined;
}

export function StatusSelect({
  teamId,
  value,
  onChange,
  placeholder = "Select status",
  className,
  allowClear = false,
}: StatusSelectProps) {
  const { data: statuses, isLoading } = useStatuses(teamId);

  if (isLoading) {
    return (
      <div className={cn("h-10 animate-pulse rounded-md bg-muted", className)} />
    );
  }

  return (
    <Select
      value={value ?? "__all__"}
      onValueChange={(val) => onChange(val === "__all__" ? undefined : val)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="__all__">
            <span className="text-muted-foreground">{placeholder}</span>
          </SelectItem>
        )}
        {statuses?.map((status) => (
          <SelectItem key={status.id} value={status.id}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  categoryColors[status.category]
                )}
              />
              {status.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
