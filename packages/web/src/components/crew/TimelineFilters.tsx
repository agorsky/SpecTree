import type { Epic } from '@/lib/api/types';

interface TimelineFiltersProps {
  epics: Epic[];
  selectedEpicId: string;
  onEpicChange: (epicId: string) => void;
  agents: string[];
  selectedAgent: string;
  onAgentChange: (agent: string) => void;
}

export function TimelineFilters({
  epics,
  selectedEpicId,
  onEpicChange,
  agents,
  selectedAgent,
  onAgentChange,
}: TimelineFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedEpicId}
        onChange={(e) => onEpicChange(e.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="">All Epics</option>
        {epics.map((epic) => (
          <option key={epic.id} value={epic.id}>
            {epic.name}
          </option>
        ))}
      </select>

      <select
        value={selectedAgent}
        onChange={(e) => onAgentChange(e.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="">All Agents</option>
        {agents.map((agent) => (
          <option key={agent} value={agent}>
            {agent}
          </option>
        ))}
      </select>
    </div>
  );
}
