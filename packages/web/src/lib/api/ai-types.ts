export interface AiNote {
  noteType: 'observation' | 'decision' | 'blocker' | 'next-step' | 'context';
  content: string;
  timestamp: string;
  sessionId?: string;
}

export interface AiContextResponse {
  aiContext: string | null;
  aiNotes: AiNote[];
}
