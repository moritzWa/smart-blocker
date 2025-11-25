import { useState } from 'react';

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

  return (
    <>
      {show && (
        <section className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Import from SiteBlock
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Paste your SiteBlock settings below. Supports Allow-Only Mode (*)
            and allowed sites (+).
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-3"
            placeholder={`Example:\n*\n+remnote.com\n+claude.ai\nhttps://www.youtube.com/\nhttps://www.tiktok.com/`}
          />
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-md transition-colors"
            >
              Import
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white font-semibold px-6 py-2 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="mt-8 flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
        <button
          onClick={onToggle}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          Import from SiteBlock
        </button>
      </div>
    </>
  );
}
