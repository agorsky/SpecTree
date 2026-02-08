import React from "react";
import { type Decision } from "@/lib/api/decisions";
// DecisionCard will be imported once implemented
// import { DecisionCard } from "./decision-card";

interface DecisionsListProps {
  decisions: Decision[];
  groupByCategory?: boolean;
}

const categoryIcons: Record<string, { icon: string; color: string }> = {
  architecture: { icon: "🏗️", color: "#2563eb" }, // blue
  library: { icon: "📦", color: "#22c55e" }, // green
  approach: { icon: "🔧", color: "#f59e42" }, // amber
  scope: { icon: "📐", color: "#a21caf" }, // purple
  design: { icon: "🎨", color: "#ec4899" }, // pink
  tradeoff: { icon: "⚖️", color: "#f97316" }, // orange
  deferral: { icon: "⏳", color: "#64748b" }, // gray
};

function parseAlternatives(alternatives: string[] | null | unknown): string[] {
  if (!alternatives) return [];
  if (Array.isArray(alternatives)) return alternatives;
  if (typeof alternatives === 'string') {
    try { return JSON.parse(alternatives); } catch { return []; }
  }
  return [];
}

const DecisionsList: React.FC<DecisionsListProps> = ({ decisions, groupByCategory = false }) => {
  if (!decisions || decisions.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">No decisions have been made yet.</div>
    );
  }

  // Group decisions by category if enabled
  const grouped = groupByCategory
    ? decisions.reduce<Record<string, Decision[]>>((acc, d) => {
        const cat = d.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(d);
        return acc;
      }, {})
    : { All: decisions };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Decisions</h2>
        <span className="text-sm text-gray-500">{decisions.length} total</span>
      </div>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-6">
          {groupByCategory && (
            <div className="flex items-center mb-2">
              <span
                className="mr-2 text-lg"
                style={{ color: categoryIcons[category]?.color || "#64748b" }}
              >
                {categoryIcons[category]?.icon || "❓"}
              </span>
              <span className="font-medium text-gray-700">{category}</span>
              <span className="ml-2 text-xs text-gray-400">{items.length} decisions</span>
            </div>
          )}
          <div className="space-y-4">
            {/* Replace below with <DecisionCard /> when implemented */}
            {items.map((d) => (
              <div
                key={d.id}
                className="border rounded-lg p-4 bg-white shadow-sm"
              >
                <div className="flex items-center mb-2">
                  <span
                    className="mr-2 text-lg"
                    style={{ color: categoryIcons[d.category]?.color || "#64748b" }}
                  >
                    {categoryIcons[d.category]?.icon || "❓"}
                  </span>
                  <span className="font-semibold text-gray-800">{d.question}</span>
                  <span className="ml-2 text-xs bg-gray-100 rounded px-2 py-0.5 text-gray-600">
                    [{d.category}]
                  </span>
                  <span className="ml-auto text-xs font-medium" style={{ color: d.impact === "high" ? "#dc2626" : d.impact === "medium" ? "#f59e42" : "#22c55e" }}>
                    {d.impact}
                  </span>
                </div>
                <div className="mb-2 text-sm text-gray-900">{d.decision}</div>
                {/* Placeholder for rationale/alternatives, collapsible in DecisionCard */}
                {d.rationale && (
                  <div className="mt-2 text-xs text-gray-500">Rationale: {d.rationale}</div>
                )}
                {(() => {
                  const alts = parseAlternatives(d.alternatives);
                  return alts.length > 0 ? (
                  <div className="mt-2 text-xs text-gray-500">
                    Alternatives:
                    <ul className="list-disc ml-4">
                      {alts.map((alt, idx) => (
                        <li key={idx}>{alt}</li>
                      ))}
                    </ul>
                  </div>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DecisionsList;
