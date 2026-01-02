export interface UnblockedSite {
  domain: string;
  expiryTime: number;
}

export interface TodoReminder {
  id: string;
  url: string;
  hostname: string;
  note?: string;
  timestamp: number;
}

export interface AccessAttempt {
  id: string;
  domain: string;
  reason: string;
  timestamp: number;
  outcome: 'approved' | 'rejected' | 'reminder' | 'abandoned' | 'blocked';
  durationSeconds?: number;
  aiMessage?: string;
}
