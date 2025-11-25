import { useState, useRef, useEffect } from 'react';

interface AIResponse {
  valid: boolean;
  seconds: number;
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
      seconds: aiResponse.seconds,
    });

    if (response.success) {
      window.location.href = blockedUrl;
    }
  };

  // Helper to format seconds into human-readable time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} sec`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes} min`;
    }
    return `${minutes}m ${remainingSeconds}s`;
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
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center font-sans">
      <div className="text-center max-w-2xl px-10 py-12">
        <div className="text-7xl mb-6">🚫</div>

        <h1 className="text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Smart Blocker - Blocked
        </h1>

        <p className="text-2xl text-gray-600 dark:text-gray-400 mb-10">
          {hostname}
        </p>

        {!aiResponse ? (
          <>
            {!showTodoInput ? (
              <>
                {/* Option 1: AI Validation */}
                <div className="mb-8">
                  <label className="block mb-4 text-gray-700 dark:text-gray-300 font-medium text-lg">
                    Why do you want to access this?
                  </label>
                  <input
                    ref={reasonInputRef}
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitReason()}
                    placeholder="e.g., Check Facebook Marketplace listings..."
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:border-green-500 dark:focus:border-green-400"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                )}

                <button
                  onClick={handleSubmitReason}
                  disabled={!reason.trim() || loading}
                  className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg mb-6"
                >
                  {loading ? 'Validating...' : 'Submit'}
                </button>

                {/* Separator and alternative options */}
                <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowTodoInput(true)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                    >
                      Remind Me Later
                    </button>
                    <button
                      onClick={() => window.history.back()}
                      disabled={loading}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Remind Me Later Form */}
                <div>
                  <label className="block mb-4 text-gray-700 dark:text-gray-300 font-medium text-lg">
                    Optional note:
                  </label>
                  <input
                    type="text"
                    value={todoNote}
                    onChange={(e) => setTodoNote(e.target.value)}
                    placeholder="e.g., Check marketplace messages"
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveTodoReminder}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                    >
                      Save Reminder
                    </button>
                    <button
                      onClick={() => setShowTodoInput(false)}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* AI Response Display */}
            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-left">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-3xl">{aiResponse.valid ? '✅' : '❌'}</div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    {aiResponse.valid ? 'Request Approved' : 'Request Denied'}
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                    {aiResponse.reasoning}
                  </p>
                  {aiResponse.valid && (
                    <p className="text-green-600 dark:text-green-400 font-semibold mt-3 text-lg">
                      Time allocated: {formatTime(aiResponse.seconds)}
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
                    className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Unblock for {formatTime(aiResponse.seconds)}
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setTodoNote(reason); // Auto-fill with original reason
                      setShowTodoInput(true);
                      setAiResponse(null); // Hide AI response
                    }}
                    className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Add to To-Do List
                  </button>
                  <button
                    onClick={() => window.history.back()}
                    className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
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
