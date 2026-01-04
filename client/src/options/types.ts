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

export type AccessAttemptOutcome =
  | 'approved'
  | 'rejected'
  | 'reminder'
  | 'abandoned'
  | 'blocked';

export interface AccessAttempt {
  id: string;
  domain: string;
  reason: string;
  timestamp: number;
  outcome: AccessAttemptOutcome;
  durationSeconds?: number;
  aiMessage?: string;
}
