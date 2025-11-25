import { useState, useRef, useEffect } from 'react';

interface BlockOverlayProps {
  hostname: string;
  onUnblock: (minutes: number) => void;
  onGoBack: () => void;
}

interface AIResponse {
  valid: boolean;
  minutes: number;
  reasoning: string;
}

export default function BlockOverlay({
  hostname,
  onUnblock,
  onGoBack,
}: BlockOverlayProps) {
  const [reason, setReason] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
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

  const handleConfirmUnblock = () => {
    if (aiResponse?.valid) {
      onUnblock(aiResponse.minutes);
    }
  };

  const handleReset = () => {
    setAiResponse(null);
    setReason('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="fixed inset-0 bg-white/60 z-2147483647 flex items-center justify-center font-sans">
      <div className="text-center max-w-2xl px-10 py-12">
        <div className="text-7xl mb-6">🚫</div>

        <h1 className="text-5xl font-bold text-gray-800 mb-4">Site Blocked</h1>

        <p className="text-2xl text-gray-600 mb-10">{hostname}</p>

        {!aiResponse ? (
          <>
            <div className="mb-8">
              <label className="block mb-4 text-gray-700 font-medium text-lg">
                Why do you want to access this?
              </label>
              <input
                ref={inputRef}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Check FB Marketplace.."
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                style={{ display: 'block' }}
                disabled={loading}
              />
            </div>

            {error && <p className="text-red-600 mb-4">{error}</p>}

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleSubmit}
                disabled={!reason.trim() || loading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
              >
                {loading ? 'Validating...' : 'Submit'}
              </button>

              <button
                onClick={onGoBack}
                disabled={loading}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold px-10 py-4 rounded-lg transition-colors text-lg"
              >
                Go Back
              </button>
            </div>
          </>
        ) : (
          <>
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
                    onClick={onGoBack}
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
