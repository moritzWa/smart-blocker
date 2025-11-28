import { useState, useRef, useEffect } from 'react';
import ReasonForm from './components/ReasonForm';
import TodoReminderForm from './components/TodoReminderForm';
import AIResponseDisplay from './components/AIResponseDisplay';
import { Skeleton } from '@/components/ui/skeleton';

interface AIResponse {
  valid: boolean;
  seconds: number;
  message: string;
}

export default function BlockedPage() {
  const [blockedUrl, setBlockedUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [reason, setReason] = useState('');
  const [todoNote, setTodoNote] = useState('');
  const [showTodoInput, setShowTodoInput] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const reasonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get blocked URL from query params
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') || '';
    setBlockedUrl(url);

    try {
      const urlObj = new URL(url);
      // Remove www. prefix and trailing slash for cleaner display
      const hostname = urlObj.hostname.replace(/^www\./, '');
      const pathname = urlObj.pathname.replace(/\/$/, '');
      setDisplayUrl(hostname + pathname + urlObj.search);
    } catch {
      setDisplayUrl(url);
    }

    // Check if strict mode is enabled
    chrome.storage.sync.get(['strictMode'], (result) => {
      setStrictMode(!!result.strictMode);
    });

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
        hostname: displayUrl,
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

    // Extract just the hostname for unblocking (remove path/query params and www)
    const hostnameOnly = new URL(blockedUrl).hostname;
    const domain = hostnameOnly.replace(/^www\./, '');
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
    // Check if this is the first time creating a reminder
    const result = await chrome.storage.sync.get({ hasCreatedFirstReminder: false });
    const isFirstReminder = !result.hasCreatedFirstReminder;

    await chrome.runtime.sendMessage({
      type: 'ADD_TODO_REMINDER',
      url: blockedUrl,
      note: todoNote.trim() || undefined,
    });

    if (isFirstReminder) {
      // Mark that user has created their first reminder
      await chrome.storage.sync.set({ hasCreatedFirstReminder: true });

      // Open options page with highlight parameter in URL
      console.log('🎉 First reminder! Opening options page to show where reminders go');
      const optionsUrl = chrome.runtime.getURL('src/options/options.html') + '?highlightTodos=true';
      chrome.tabs.create({ url: optionsUrl });
    } else {
      // Go back 2 steps to avoid redirect loop (skip blocked URL + blocked page)
      console.log('🔙 Going back 2 steps in history after saving todo');
      window.history.go(-2);
    }
  };

  const handleReset = () => {
    setAiResponse(null);
    setReason('');
    setError(null);
    setTimeout(() => reasonInputRef.current?.focus(), 0);
  };

  const handleGoBack = () => {
    console.log('🔙 Going back 2 steps in history to avoid redirect loop');
    window.history.go(-2);
  };

  const handleAddToTodo = () => {
    setTodoNote(reason); // Auto-fill with original reason
    setShowTodoInput(true);
    setAiResponse(null); // Hide AI response
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-sans">
      <div className="text-center max-w-2xl px-10 py-12">
        <img
          src={strictMode ? '/logo-strict-mode.png' : '/logo.png'}
          alt="Focus Shield"
          className="w-32 h-32 mx-auto mb-6"
        />

        <h1 className="text-5xl font-bold text-foreground mb-4">
          {strictMode ? 'Focus Shield - Strict Mode' : 'Focus Shield'}
        </h1>

        <p className="text-2xl text-foreground mb-10">
          Blocked: <span className="text-muted-foreground line-clamp-2 block">{displayUrl}</span>
        </p>

        {loading && !aiResponse ? (
          // Loading skeleton
          <>
            <div className="mb-8 p-6 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 flex-1" />
            </div>
          </>
        ) : !aiResponse ? (
          <>
            {!showTodoInput ? (
              <ReasonForm
                reason={reason}
                setReason={setReason}
                onSubmit={handleSubmitReason}
                loading={loading}
                error={error}
                inputRef={reasonInputRef}
                onShowTodoInput={() => setShowTodoInput(true)}
                onGoBack={handleGoBack}
              />
            ) : (
              <TodoReminderForm
                todoNote={todoNote}
                setTodoNote={setTodoNote}
                onSave={handleSaveTodoReminder}
                onCancel={() => setShowTodoInput(false)}
              />
            )}
          </>
        ) : (
          <AIResponseDisplay
            aiResponse={aiResponse}
            reason={reason}
            formatTime={formatTime}
            onConfirmUnblock={handleConfirmUnblock}
            onReset={handleReset}
            onAddToTodo={handleAddToTodo}
            onGoBack={handleGoBack}
          />
        )}
      </div>
    </div>
  );
}
