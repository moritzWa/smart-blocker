import { Clock, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UnblockedSite {
  domain: string;
  expiryTime: number;
}

interface UnblockedSitesListProps {
  unblockedSites: UnblockedSite[];
  formatTimeRemaining: (expiryTime: number) => string;
  onEndBreak: (domain: string) => void;
}

// Get favicon URL from Google's service
function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

export default function UnblockedSitesList({
  unblockedSites,
  formatTimeRemaining,
  onEndBreak,
}: UnblockedSitesListProps) {
  if (unblockedSites.length === 0) {
    return null;
  }

  return (
    <Card className="p-3 rounded-xl">
      <h2 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
        <Clock size={16} />
        Currently Unblocked
      </h2>
      <div className="space-y-1">
        {unblockedSites.map(({ domain, expiryTime }) => (
          <div
            key={domain}
            className="flex items-center gap-2 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-950/30"
          >
            <img
              src={getFaviconUrl(domain)}
              alt=""
              className="w-4 h-4 rounded-sm flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="flex-1 text-sm truncate">{domain}</span>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap">
              {formatTimeRemaining(expiryTime)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
              onClick={() => onEndBreak(domain)}
              title="End break immediately"
            >
              <X size={12} className="mr-0.5" />
              End
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
