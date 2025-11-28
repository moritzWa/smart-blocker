export function formatTimeRemaining(expiryTime: number): string {
  const remaining = Math.max(0, expiryTime - Date.now());
  const minutes = Math.ceil(remaining / 60000);
  return `${minutes}m left`;
}

export function parseSiteBlockFormat(text: string): {
  allowedSites: string[];
  blockedSites: string[];
  strictMode: boolean;
} {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l);
  const allowedSites: string[] = [];
  const blockedSites: string[] = [];
  let strictMode = false;

  // Check if first line is '*' (Strict Mode)
  if (lines[0] === '*') {
    strictMode = true;
    lines.shift(); // Remove the '*' line
  }

  for (const line of lines) {
    if (line.startsWith('+')) {
      // Allowed site - strip the '+' prefix
      const site = line.substring(1).trim();
      if (site) allowedSites.push(site);
    } else if (line !== '*') {
      // Blocked site
      blockedSites.push(line);
    }
  }

  return { allowedSites, blockedSites, strictMode };
}
