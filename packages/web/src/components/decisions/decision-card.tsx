import * as React from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@radix-ui/react-collapsible';

export type Decision = {
  id: string;
  title: string;
  category: string;
  question: string;
  answer: string;
  impact: 'low' | 'medium' | 'high';
  alternatives?: string[];
  rationale?: string;
  madeBy?: string;
  timestamp?: string;
};

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  architecture: { emoji: '🏗️', color: '#2563eb' }, // blue
  library: { emoji: '📦', color: '#22c55e' }, // green
  approach: { emoji: '🔧', color: '#f59e42' }, // amber
  scope: { emoji: '📐', color: '#a21caf' }, // purple
  design: { emoji: '🎨', color: '#ec4899' }, // pink
  tradeoff: { emoji: '⚖️', color: '#f97316' }, // orange
  deferral: { emoji: '⏳', color: '#64748b' }, // gray
};

function ImpactDots({ impact }: { impact: 'low' | 'medium' | 'high' }) {
  const count = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
  return (
    <span aria-label={`Impact: ${impact}`} style={{ display: 'inline-flex', gap: 2 }}>
      {[...Array(count)].map((_, i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', display: 'inline-block' }} />
      ))}
    </span>
  );
}

export const DecisionCard: React.FC<{ decision: Decision }> = ({ decision }) => {
  const [open, setOpen] = React.useState(false);
  const meta = CATEGORY_META[decision.category] || { emoji: '❓', color: '#94a3b8' };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="decision-card" style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16, background: '#fff', boxShadow: '0 1px 3px #0001', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20, background: meta.color, borderRadius: 6, padding: '2px 8px', color: '#fff', fontWeight: 600 }}>{meta.emoji}</span>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{decision.title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: meta.color, fontWeight: 500 }}>[{decision.category}]</span>
        <ImpactDots impact={decision.impact} />
      </div>
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14, color: '#475569' }}><strong>Q:</strong> {decision.question}</div>
        <div style={{ fontSize: 14, color: '#334155', marginTop: 2 }}><strong>A:</strong> {decision.answer}</div>
      </div>
      <CollapsibleTrigger asChild>
        <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, padding: 0, marginTop: 4 }}>
          {open ? '▲ Hide rationale' : '▼ Show rationale'}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div style={{ marginTop: 12, fontSize: 13, color: '#475569' }}>
          {decision.rationale && (
            <div><strong>Rationale:</strong> {decision.rationale}</div>
          )}
          {decision.alternatives && decision.alternatives.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Alternatives:</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {decision.alternatives.map((alt, i) => (
                  <li key={i}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
            {decision.madeBy && <span>Made by: {decision.madeBy} </span>}
            {decision.timestamp && <span>on {new Date(decision.timestamp).toLocaleString()}</span>}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default DecisionCard;
