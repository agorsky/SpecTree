import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/queries/use-projects";
import { cn } from "@/lib/utils";
import { Folder } from "lucide-react";

interface ProjectSelectProps {
  value?: string;
  onChange: (projectId: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProjectSelect({
  value,
  onChange,
  placeholder = "Select project",
  className,
}: ProjectSelectProps) {
  const { data, isLoading } = useProjects();

  if (isLoading) {
    return (
      <div className={cn("h-10 animate-pulse rounded-md bg-muted", className)} />
    );
  }

  const projects = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              {project.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
