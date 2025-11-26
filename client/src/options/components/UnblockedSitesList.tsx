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
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
        <Clock size={20} />
        Currently Unblocked Sites
      </h2>
      <div className="space-y-2">
        {unblockedSites.map(({ domain, expiryTime }) => (
          <div
            key={domain}
            className="flex justify-between items-center bg-white dark:bg-gray-700 px-3 py-2 rounded border border-border"
          >
            <span className="font-mono text-sm text-gray-800 dark:text-gray-200">
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
