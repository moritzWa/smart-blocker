import { useEffect, useState } from 'react';

interface UnblockedSite {
  domain: string;
  expiryTime: number;
}

export default function Options() {
  const [allowedSites, setAllowedSites] = useState('');
  const [blockedSites, setBlockedSites] = useState('');
  const [defaultMinutes, setDefaultMinutes] = useState(5);
  const [status, setStatus] = useState('');
  const [unblockedSites, setUnblockedSites] = useState<UnblockedSite[]>([]);

  useEffect(() => {
    loadSettings();
    loadUnblockedSites();

    // Update unblocked sites every 5 seconds
    const interval = setInterval(loadUnblockedSites, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadSettings() {
    const result = await chrome.storage.sync.get({
      allowedSites: [],
      blockedSites: [],
      defaultUnblockMinutes: 5,
    });

    setAllowedSites((result.allowedSites as string[]).join('\n'));
    setBlockedSites((result.blockedSites as string[]).join('\n'));
    setDefaultMinutes(result.defaultUnblockMinutes as number);
  }

  async function loadUnblockedSites() {
    const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
    const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;

    const sites: UnblockedSite[] = [];
    const now = Date.now();

    for (const [domain, expiryTime] of Object.entries(temporaryUnblocks)) {
      if (expiryTime > now) {
        sites.push({ domain, expiryTime });
      }
    }

    // Sort by expiry time (soonest first)
    sites.sort((a, b) => a.expiryTime - b.expiryTime);
    setUnblockedSites(sites);
  }

  async function saveSettings() {
    const allowedSitesList = allowedSites.split('\n').filter((s) => s.trim());
    const blockedSitesList = blockedSites.split('\n').filter((s) => s.trim());

    await chrome.storage.sync.set({
      allowedSites: allowedSitesList,
      blockedSites: blockedSitesList,
      defaultUnblockMinutes: defaultMinutes,
    });

    setStatus('Settings saved!');
    setTimeout(() => setStatus(''), 1000);
  }

  function formatTimeRemaining(expiryTime: number): string {
    const remaining = Math.max(0, expiryTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Smart Blocker Settings
        </h1>

        {unblockedSites.length > 0 && (
          <section className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">
              Currently Unblocked Sites
            </h2>
            <div className="space-y-2">
              {unblockedSites.map(({ domain, expiryTime }) => (
                <div
                  key={domain}
                  className="flex justify-between items-center bg-white px-3 py-2 rounded border border-blue-100"
                >
                  <span className="font-mono text-sm text-gray-800">{domain}</span>
                  <span className="text-sm text-blue-600 font-medium">
                    {formatTimeRemaining(expiryTime)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Always Allowed Sites
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            One site per line. These sites will never be blocked.
          </p>
          <textarea
            value={allowedSites}
            onChange={(e) => setAllowedSites(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+remnote.com&#10;+claude.ai&#10;+calendar.google.com"
          />
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Blocked Sites
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            One site per line. These sites will be blocked.
          </p>
          <textarea
            value={blockedSites}
            onChange={(e) => setBlockedSites(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://www.youtube.com/&#10;https://www.tiktok.com/&#10;https://www.facebook.com/"
          />
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Default Unblock Duration
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={defaultMinutes}
              onChange={(e) => setDefaultMinutes(parseInt(e.target.value) || 5)}
              min="1"
              max="60"
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="text-gray-700">minutes</label>
          </div>
        </section>

        <button
          onClick={saveSettings}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-md transition-colors"
        >
          Save Settings
        </button>

        {status && (
          <span className="ml-4 text-green-600 font-medium">{status}</span>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <a
            href="https://github.com/yourusername/smart-blocker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Contribute on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
