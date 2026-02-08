export interface AiNote {
  type: 'observation' | 'decision' | 'blocker' | 'next-step' | 'context';
  content: string;
  timestamp: string;
  sessionId?: string;
}

export interface AiContextResponse {
  aiContext: string | null;
  aiNotes: AiNote[];
  lastAiSessionId: string | null;
  lastAiUpdateAt: string | null;
}
