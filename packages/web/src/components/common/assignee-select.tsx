import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUsers } from "@/hooks/queries/use-users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AssigneeSelectProps {
  value?: string | undefined;
  onChange: (assigneeId: string | undefined) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  allowUnassigned?: boolean | undefined;
  allowClear?: boolean | undefined;
}

export function AssigneeSelect({
  value,
  onChange,
  placeholder = "Select assignee",
  className,
  allowUnassigned = true,
  allowClear = false,
}: AssigneeSelectProps) {
  const { data: users, isLoading } = useUsers();

  if (isLoading) {
    return (
      <div className={cn("h-10 animate-pulse rounded-md bg-muted", className)} />
    );
  }

  // Determine the select value
  const selectValue = value ?? (allowClear ? "__all__" : "__unassigned__");

  return (
    <Select
      value={selectValue}
      onValueChange={(val) => {
        if (val === "__all__" || val === "__unassigned__") {
          onChange(undefined);
        } else {
          onChange(val);
        }
      }}
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
        {allowUnassigned && !allowClear && (
          <SelectItem value="__unassigned__">
            <span className="text-muted-foreground">Unassigned</span>
          </SelectItem>
        )}
        {users?.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {user.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
