import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Get favicon URL from Google's service
function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

interface SiteListWithPauseProps {
  label: string;
  description: string;
  sites: string[];
  onSitesChange: (sites: string[]) => void;
  placeholder: string;
}

export default function SiteListWithPause({
  label,
  description,
  sites,
  onSitesChange,
  placeholder,
}: SiteListWithPauseProps) {
  const [newSite, setNewSite] = useState('');

  function handleAddSite() {
    const trimmed = newSite.trim();
    if (!trimmed) return;
    if (!sites.includes(trimmed)) {
      onSitesChange([...sites, trimmed]);
    }
    setNewSite('');
  }

  function handleRemoveSite(index: number) {
    const updated = sites.filter((_, i) => i !== index);
    onSitesChange(updated);
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-foreground mb-0.5">
        {label}
      </h2>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>

      {/* Site list */}
      {sites.length > 0 && (
        <div className="space-y-0 mb-2 max-h-[200px] overflow-y-auto">
          {sites.map((site, index) => (
            <div
              key={`${site}-${index}`}
              className="flex items-center gap-2 group py-0.5 px-2 rounded-md hover:bg-muted/50"
            >
              <img
                src={getFaviconUrl(site)}
                alt=""
                className="w-4 h-4 rounded-sm flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="flex-1 text-sm truncate">{site}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveSite(index)}
                title="Remove site"
              >
                <X size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add site input */}
      <div className="flex gap-1.5">
        <Input
          value={newSite}
          onChange={(e) => setNewSite(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddSite();
            }
          }}
          placeholder={placeholder}
          className="text-sm !py-1.5 !px-3 !text-sm"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddSite}
          disabled={!newSite.trim()}
          className="flex-shrink-0"
        >
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>
    </section>
  );
}
