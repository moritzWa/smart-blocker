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
