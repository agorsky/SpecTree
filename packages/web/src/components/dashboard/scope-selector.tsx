import type { ActivityScope } from '@/lib/api/user-activity';
import { ScopeSelector as GenericScopeSelector, type ScopeMode } from '@/components/common/scope-selector';

interface ScopeSelectorProps {
  scope: ActivityScope;
  scopeId?: string;
  onScopeChange: (scope: ActivityScope, scopeId?: string) => void;
}

/**
 * Activity Dashboard-specific wrapper around the shared ScopeSelector.
 * Maps ActivityScope ('self' | 'all' | 'team' | 'user') to the generic ScopeMode.
 */
export function ScopeSelector({ scope, scopeId, onScopeChange }: ScopeSelectorProps) {
  // Map ActivityScope to ScopeMode ('self' -> 'my')
  const mappedScope: ScopeMode = scope === 'self' ? 'my' : scope;

  const handleScopeChange = (newScope: ScopeMode, newScopeId?: string) => {
    // Map ScopeMode back to ActivityScope ('my' -> 'self')
    const mappedActivityScope: ActivityScope = newScope === 'my' ? 'self' : newScope;
    onScopeChange(mappedActivityScope, newScopeId);
  };

  return (
    <GenericScopeSelector
      scope={mappedScope}
      {...(scopeId !== undefined && { scopeId })}
      onScopeChange={handleScopeChange}
      entityLabel="Activity"
    />
  );
}
