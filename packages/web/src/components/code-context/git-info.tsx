import React from "react";
import { GitBranch, GitCommit, GitPullRequest } from "lucide-react";

// Accepts codeContext object from useFeatureCodeContext/useTaskCodeContext
export interface GitInfoProps {
  branch?: string | null;
  commits?: string[];
  pr?: { number: number; url: string; title?: string } | null;
}

export const GitInfo: React.FC<GitInfoProps> = ({ branch, commits, pr }) => {
  if (!branch && (!commits || commits.length === 0) && !pr) return null;

  return (
    <div className="space-y-2">
      {branch && (
        <div className="flex items-center gap-2">
          <GitBranch size={18} />
          <span className="font-mono text-sm">{branch}</span>
        </div>
      )}
      {commits && commits.length > 0 && (
        <div className="flex items-center gap-2">
          <GitCommit size={18} />
          <span className="font-mono text-sm">
            {commits.map((sha, i) => (
              <React.Fragment key={sha}>
                {/* If commit URL pattern known, link. Otherwise, just show SHA. */}
                <span>{sha.slice(0, 7)}</span>
                {i < commits.length - 1 && ", "}
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
      {pr && (
        <div className="flex items-center gap-2">
          <GitPullRequest size={18} />
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm underline hover:text-blue-600"
          >
            #{pr.number} {pr.title ? `"${pr.title}"` : ""} <span aria-label="External link">→</span>
          </a>
        </div>
      )}
    </div>
  );
};
