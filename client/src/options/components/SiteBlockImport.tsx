import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface SiteBlockImportProps {
  show: boolean;
  onToggle: () => void;
  onImport: (text: string) => void;
}

export default function SiteBlockImport({
  show,
  onToggle,
  onImport,
}: SiteBlockImportProps) {
  const [importText, setImportText] = useState('');

  const handleImport = () => {
    if (importText.trim()) {
      onImport(importText);
      setImportText('');
    }
  };

  const handleCancel = () => {
    onToggle();
    setImportText('');
  };

  if (!show) {
    return null;
  }

  return (
    <section className="mb-6 p-4 bg-muted border border-border rounded-lg">
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Import from SiteBlock
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Paste your SiteBlock settings below. Supports Strict Mode (*) and
        allowed sites (+).
      </p>
      <Textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        rows={10}
        className="mb-3"
        placeholder={`Example:\n*\n+remnote.com\n+claude.ai\nyoutube.com\ntiktok.com`}
      />
      <div className="flex gap-2">
        <Button
          onClick={handleImport}
          disabled={!importText.trim()}
          size="sm"
        >
          Import
        </Button>
        <Button
          onClick={handleCancel}
          variant="secondary"
          size="sm"
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}
