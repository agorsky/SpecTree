import type { UserActivityDataPoint, ActivityInterval } from './api/user-activity';

function formatDate(isoDate: string, interval: ActivityInterval): string {
  const d = new Date(isoDate);
  if (interval === 'day') {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (interval === 'week') {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportToCsv(data: UserActivityDataPoint[], interval: ActivityInterval) {
  const header = 'Period,Features Created,Tasks Completed,Decisions Logged,AI Sessions,Total';
  const rows = data.map((d) =>
    [
      `"${formatDate(d.intervalStart, interval)}"`,
      d.featuresCreated,
      d.tasksCompleted,
      d.decisionsLogged,
      d.aiSessions,
      d.totalActivity,
    ].join(',')
  );
  downloadBlob([header, ...rows].join('\n'), `activity-${interval}-${timestamp()}.csv`, 'text/csv');
}

export function exportToJson(data: UserActivityDataPoint[], interval: ActivityInterval) {
  const payload = {
    exportedAt: new Date().toISOString(),
    interval,
    data: data.map((d) => ({
      period: formatDate(d.intervalStart, interval),
      intervalStart: d.intervalStart,
      intervalEnd: d.intervalEnd,
      featuresCreated: d.featuresCreated,
      tasksCompleted: d.tasksCompleted,
      decisionsLogged: d.decisionsLogged,
      aiSessions: d.aiSessions,
      totalActivity: d.totalActivity,
    })),
  };
  downloadBlob(
    JSON.stringify(payload, null, 2),
    `activity-${interval}-${timestamp()}.json`,
    'application/json'
  );
}

export function exportToMarkdown(data: UserActivityDataPoint[], interval: ActivityInterval) {
  const lines: string[] = [
    `# Activity Report (${interval})`,
    ``,
    `*Exported: ${new Date().toLocaleString()}*`,
    ``,
  ];

  // Summary
  const totals = data.reduce(
    (acc, d) => ({
      features: acc.features + d.featuresCreated,
      tasks: acc.tasks + d.tasksCompleted,
      decisions: acc.decisions + d.decisionsLogged,
      sessions: acc.sessions + d.aiSessions,
    }),
    { features: 0, tasks: 0, decisions: 0, sessions: 0 }
  );

  lines.push(
    `## Summary`,
    ``,
    `| Metric | Total |`,
    `|--------|-------|`,
    `| Features Created | ${totals.features} |`,
    `| Tasks Completed | ${totals.tasks} |`,
    `| Decisions Logged | ${totals.decisions} |`,
    `| AI Sessions | ${totals.sessions} |`,
    ``,
  );

  // Detail table
  lines.push(
    `## Breakdown`,
    ``,
    `| Period | Features | Tasks | Decisions | Sessions | Total |`,
    `|--------|----------|-------|-----------|----------|-------|`,
  );

  for (const d of data) {
    lines.push(
      `| ${formatDate(d.intervalStart, interval)} | ${d.featuresCreated} | ${d.tasksCompleted} | ${d.decisionsLogged} | ${d.aiSessions} | ${d.totalActivity} |`
    );
  }

  downloadBlob(lines.join('\n'), `activity-${interval}-${timestamp()}.md`, 'text/markdown');
}

export function exportToPdf() {
  window.print();
}
