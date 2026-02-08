import React from 'react';
import { useFeatureCodeContext, useTaskCodeContext } from '@/hooks/queries/use-code-context';
import type { CodeContextResponse } from '@/lib/api/types';

interface CodeContextPanelProps {
  featureId?: string;
  taskId?: string;
}

const CodeContextPanel: React.FC<CodeContextPanelProps> = ({ featureId, taskId }) => {
  // Use the appropriate hook based on which prop is provided
  const featureQuery = useFeatureCodeContext(featureId ?? '');
  const taskQuery = useTaskCodeContext(taskId ?? '');
  
  // Choose the relevant query based on props
  const query = featureId ? featureQuery : taskQuery;
  const context: CodeContextResponse | undefined = query.data;

  // Loading state
  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Code Context</h3>
        <div className="text-muted-foreground text-sm">Loading code context...</div>
      </div>
    );
  }

  // Error state
  if (query.isError) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Code Context</h3>
        <div className="text-destructive text-sm">Failed to load code context</div>
      </div>
    );
  }

  // Empty state - no code context linked yet
  const hasFiles = context?.relatedFiles && context.relatedFiles.length > 0;
  const hasFunctions = context?.relatedFunctions && context.relatedFunctions.length > 0;
  const hasGit = context?.gitBranch || (context?.gitCommits && context.gitCommits.length > 0) || context?.gitPrNumber;

  if (!hasFiles && !hasFunctions && !hasGit) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Code Context</h3>
        <div className="text-muted-foreground text-sm">
          No code context linked yet. Code context is populated when AI agents work on this item.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Code Context</h3>
      
      {/* Files Modified */}
      {hasFiles && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Files ({context!.relatedFiles.length})
          </div>
          <ul className="space-y-1">
            {context!.relatedFiles.map((file: string, idx: number) => (
              <li key={idx} className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {file}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Functions Modified */}
      {hasFunctions && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Functions ({context!.relatedFunctions.length})
          </div>
          <ul className="space-y-1">
            {context!.relatedFunctions.map((fn: string, idx: number) => (
              <li key={idx} className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {fn}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Git Info */}
      {hasGit && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Git</div>
          <div className="space-y-1 text-sm">
            {context!.gitBranch && (
              <div>
                <span className="text-muted-foreground">Branch: </span>
                <span className="font-mono">{context!.gitBranch}</span>
              </div>
            )}
            {context!.gitCommits && context!.gitCommits.length > 0 && (
              <div>
                <span className="text-muted-foreground">Commits: </span>
                <span className="font-mono">{context!.gitCommits.join(', ')}</span>
              </div>
            )}
            {context!.gitPrNumber && (
              <div>
                <span className="text-muted-foreground">PR: </span>
                {context!.gitPrUrl ? (
                  <a 
                    href={context!.gitPrUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    #{context!.gitPrNumber}
                  </a>
                ) : (
                  <span>#{context!.gitPrNumber}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeContextPanel;
