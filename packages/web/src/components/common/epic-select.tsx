import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEpics } from "@/hooks/queries/use-epics";
import { cn } from "@/lib/utils";
import { Folder } from "lucide-react";

interface EpicSelectProps {
  value?: string;
  onChange: (epicId: string) => void;
  placeholder?: string;
  className?: string;
}

export function EpicSelect({
  value,
  onChange,
  placeholder = "Select epic",
  className,
}: EpicSelectProps) {
  const { data, isLoading } = useEpics();

  if (isLoading) {
    return (
      <div className={cn("h-10 animate-pulse rounded-md bg-muted", className)} />
    );
  }

  const epics = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {epics.map((epic) => (
          <SelectItem key={epic.id} value={epic.id}>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              {epic.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
