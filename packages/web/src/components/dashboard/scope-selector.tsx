import type { ActivityScope } from '@/lib/api/user-activity';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeams } from '@/hooks/queries/use-teams';
import { useUsers } from '@/hooks/queries/use-users';

interface ScopeSelectorProps {
  scope: ActivityScope;
  scopeId?: string;
  onScopeChange: (scope: ActivityScope, scopeId?: string) => void;
}

const scopeOptions: Array<{ label: string; value: ActivityScope }> = [
  { label: 'My Activity', value: 'self' },
  { label: 'All Activity', value: 'all' },
  { label: 'By Team', value: 'team' },
  { label: 'By User', value: 'user' },
];

export function ScopeSelector({ scope, scopeId, onScopeChange }: ScopeSelectorProps) {
  const { data: teamsData } = useTeams();
  const { data: usersData } = useUsers({ limit: 1000 });

  const teams = teamsData?.data ?? [];
  const users = usersData ?? [];

  const handleScopeChange = (newScope: ActivityScope) => {
    if (newScope === 'self' || newScope === 'all') {
      onScopeChange(newScope, undefined);
    } else {
      // Reset scopeId when changing to team/user scope
      onScopeChange(newScope, undefined);
    }
  };

  const handleScopeIdChange = (newScopeId: string) => {
    onScopeChange(scope, newScopeId);
  };

  const showTeamSelector = scope === 'team';
  const showUserSelector = scope === 'user';

  return (
    <div className="flex items-center gap-2">
      <Select value={scope} onValueChange={(v) => handleScopeChange(v as ActivityScope)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {scopeOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showTeamSelector && (
        <Select value={scopeId || ''} onValueChange={handleScopeIdChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select team..." />
          </SelectTrigger>
          <SelectContent>
            {teams.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No teams available</div>
            ) : (
              teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {showUserSelector && (
        <Select value={scopeId || ''} onValueChange={handleScopeIdChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select user..." />
          </SelectTrigger>
          <SelectContent>
            {users.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No users available</div>
            ) : (
              users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
