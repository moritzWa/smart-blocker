import { useState, useRef, useEffect } from 'react';

interface AIResponse {
  valid: boolean;
  minutes: number;
  reasoning: string;
}

export default function BlockedPage() {
  const [blockedUrl, setBlockedUrl] = useState('');
  const [hostname, setHostname] = useState('');
  const [reason, setReason] = useState('');
  const [todoNote, setTodoNote] = useState('');
  const [showTodoInput, setShowTodoInput] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get blocked URL from query params
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') || '';
    setBlockedUrl(url);

    try {
      const urlObj = new URL(url);
      setHostname(urlObj.hostname);
    } catch {
      setHostname(url);
    }

    // Auto-focus reason input
    setTimeout(() => reasonInputRef.current?.focus(), 100);
  }, []);

  const handleSubmitReason = async () => {
    if (!reason.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'VALIDATE_REASON',
        hostname,
        reason,
      });

      if ('error' in response) {
        setError(response.error);
      } else {
        setAiResponse(response);
      }
    } catch (err) {
      setError('Failed to connect to validation service');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUnblock = async () => {
    if (!aiResponse?.valid) return;

    const domain = hostname.replace(/^www\./, '');
    const response = await chrome.runtime.sendMessage({
      type: 'UNBLOCK_SITE',
      domain,
      minutes: aiResponse.minutes,
    });

    if (response.success) {
      window.location.href = blockedUrl;
    }
  };

  const handleSaveTodoReminder = async () => {
    await chrome.runtime.sendMessage({
      type: 'ADD_TODO_REMINDER',
      url: blockedUrl,
      note: todoNote.trim() || undefined,
    });

    // Go back after saving
    window.history.back();
  };

  const handleReset = () => {
    setAiResponse(null);
    setReason('');
    setError(null);
    setTimeout(() => reasonInputRef.current?.focus(), 0);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center font-sans">
      <div className="text-center max-w-2xl px-10 py-12">
        <div className="text-7xl mb-6">🚫</div>

        <h1 className="text-5xl font-bold text-gray-800 mb-4">Site Blocked</h1>

        <p className="text-2xl text-gray-600 mb-10">{hostname}</p>

        {!aiResponse ? (
          <>
            {/* Option 1: AI Validation */}
            <div className="mb-8">
              <label className="block mb-4 text-gray-700 font-medium text-lg">
                Why do you want to access this?
              </label>
              <input
                ref={reasonInputRef}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitReason()}
                placeholder="e.g., Check Facebook Marketplace listings..."
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                disabled={loading}
              />
            </div>

            {error && <p className="text-red-600 mb-4">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmitReason}
                disabled={!reason.trim() || loading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
              >
                {loading ? 'Validating...' : 'Submit'}
              </button>

              {/* Option 2: Remind Me Later */}
              <div className="border-t-2 border-gray-200 pt-4 mt-2">
                {!showTodoInput ? (
                  <button
                    onClick={() => setShowTodoInput(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg w-full"
                  >
                    Remind Me Later
                  </button>
                ) : (
                  <div>
                    <label className="block mb-2 text-gray-700 font-medium text-base">
                      Optional note:
                    </label>
                    <input
                      type="text"
                      value={todoNote}
                      onChange={(e) => setTodoNote(e.target.value)}
                      placeholder="e.g., Check marketplace messages"
                      className="w-full px-4 py-2 mb-3 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveTodoReminder}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                      >
                        Save Reminder
                      </button>
                      <button
                        onClick={() => setShowTodoInput(false)}
                        className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Option 3: Go Back */}
              <button
                onClick={() => window.history.back()}
                disabled={loading}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
              >
                Go Back
              </button>
            </div>
          </>
        ) : (
          <>
            {/* AI Response Display */}
            <div className="mb-8 p-6 bg-gray-50 rounded-lg text-left">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-3xl">{aiResponse.valid ? '✅' : '❌'}</div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {aiResponse.valid ? 'Request Approved' : 'Request Denied'}
                  </h2>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    {aiResponse.reasoning}
                  </p>
                  {aiResponse.valid && (
                    <p className="text-green-600 font-semibold mt-3 text-lg">
                      Time allocated: {aiResponse.minutes} minutes
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              {aiResponse.valid ? (
                <>
                  <button
                    onClick={handleConfirmUnblock}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Unblock for {aiResponse.minutes} min
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleReset}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Try Different Reason
                  </button>
                  <button
                    onClick={() => window.history.back()}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Go Back
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
