import { Clock } from 'lucide-react';

interface UnblockedSite {
  domain: string;
  expiryTime: number;
}

interface UnblockedSitesListProps {
  unblockedSites: UnblockedSite[];
  formatTimeRemaining: (expiryTime: number) => string;
}

export default function UnblockedSitesList({
  unblockedSites,
  formatTimeRemaining,
}: UnblockedSitesListProps) {
  if (unblockedSites.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 p-4 bg-muted border border-border rounded-lg">
      <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
        <Clock size={20} />
        Currently Unblocked Sites
      </h2>
      <div className="space-y-2">
        {unblockedSites.map(({ domain, expiryTime }) => (
          <div
            key={domain}
            className="flex justify-between items-center bg-background px-3 py-2 rounded border border-border"
          >
            <span className="font-mono text-sm text-foreground">
              {domain}
            </span>
            <span className="text-sm text-primary font-medium">
              {formatTimeRemaining(expiryTime)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
