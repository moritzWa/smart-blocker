import { useState, useRef, useEffect } from 'react';
import { CornerDownLeft } from 'lucide-react';

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

  // Handle Enter key to unblock when request is approved
  useEffect(() => {
    if (!aiResponse?.valid) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirmUnblock();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [aiResponse?.valid, blockedUrl]);

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
    <div className="min-h-screen bg-background flex items-center justify-center font-sans">
      <div className="text-center max-w-2xl px-10 py-12">
        <img
          src="/logo.png"
          alt="AI Site Blocker"
          className="w-32 h-32 mx-auto mb-6"
        />

        <h1 className="text-5xl font-bold text-foreground mb-4">
          AI Site Blocker - Blocked
        </h1>

        <p className="text-2xl text-muted-foreground mb-10">{hostname}</p>

        {!aiResponse ? (
          <>
            {!showTodoInput ? (
              <>
                {/* Option 1: AI Validation */}
                <div className="mb-6">
                  <label className="block mb-4 text-foreground font-medium text-lg">
                    Why do you want to access this?
                  </label>
                  <input
                    ref={reasonInputRef}
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitReason()}
                    placeholder="e.g., Check Facebook Marketplace listings..."
                    className="w-full px-4 py-3 text-lg border-2 border-input bg-input-background text-foreground rounded-lg focus:outline-none focus:border-success"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                )}

                <button
                  onClick={handleSubmitReason}
                  disabled={!reason.trim() || loading}
                  className="w-full bg-success hover:bg-success-hover disabled:bg-disabled disabled:cursor-not-allowed text-success-foreground font-semibold px-10 py-4 rounded-lg transition-colors text-lg mb-4 flex items-center justify-center gap-2"
                >
                  {loading ? 'Validating...' : 'Submit'}
                  {!loading && (
                    <CornerDownLeft size={18} className="opacity-60" />
                  )}
                </button>

                {/* Separator and alternative options */}
                <div className="border-t-2 border-border pt-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowTodoInput(true)}
                      className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                    >
                      Remind Me Later
                    </button>
                    <button
                      onClick={() => window.history.back()}
                      disabled={loading}
                      className="flex-1 bg-secondary hover:bg-secondary-hover text-secondary-foreground font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
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
                  <label className="block mb-4 text-foreground font-medium text-lg">
                    Optional note:
                  </label>
                  <input
                    type="text"
                    value={todoNote}
                    onChange={(e) => setTodoNote(e.target.value)}
                    placeholder="e.g., Check marketplace messages"
                    className="w-full px-4 py-3 text-lg border-2 border-input bg-input-background text-foreground rounded-lg focus:outline-none focus:border-primary mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveTodoReminder}
                      className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                    >
                      Save Todo Reminder
                    </button>
                    <button
                      onClick={() => setShowTodoInput(false)}
                      className="flex-1 bg-secondary hover:bg-secondary-hover text-secondary-foreground font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
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
            <div className="mb-8 p-6 bg-muted rounded-lg text-left">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-3xl">{aiResponse.valid ? '✅' : '❌'}</div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    {aiResponse.valid ? 'Request Approved' : 'Request Denied'}
                  </h2>
                  <p className="text-foreground text-lg leading-relaxed">
                    {aiResponse.reasoning}
                  </p>
                  {aiResponse.valid && (
                    <p className="text-success font-semibold mt-3 text-lg">
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
                    className="bg-success hover:bg-success-hover text-success-foreground font-semibold px-10 py-4 rounded-lg transition-colors text-lg flex items-center gap-2"
                  >
                    Unblock for {formatTime(aiResponse.seconds)}
                    <CornerDownLeft size={18} className="opacity-60" />
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-secondary hover:bg-secondary-hover text-secondary-foreground font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
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
                    className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
                  >
                    Add to To-Do List
                  </button>
                  <button
                    onClick={() => window.history.back()}
                    className="bg-secondary hover:bg-secondary-hover text-secondary-foreground font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
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
