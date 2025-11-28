import { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import ReasonForm from './components/ReasonForm';
import TodoReminderForm from './components/TodoReminderForm';
import AIResponseDisplay from './components/AIResponseDisplay';
import ReviewRequestCard from './components/ReviewRequestCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useFaviconStrictMode } from '@/hooks/useFaviconStrictMode';

interface AIResponse {
  valid: boolean;
  seconds: number;
  message: string;
}

// Helper to check if count is power of 2
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

// Check if review should be shown based on count and threshold
function shouldShowReview(count: number, baseThreshold: number): boolean {
  if (count < baseThreshold) return false;
  return isPowerOfTwo(count);
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
  const [todoSaved, setTodoSaved] = useState(false);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [reviewDismissCount, setReviewDismissCount] = useState(0);
  const reasonInputRef = useRef<HTMLInputElement>(null);

  // Update favicon based on strict mode
  useFaviconStrictMode(strictMode);

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

    // Load settings and increment blocked page view count
    chrome.storage.sync.get(
      {
        strictMode: false,
        blockedPageViewCount: 0,
        reviewDismissCount: 0,
        reviewDismissedPermanently: false,
      },
      async (result) => {
        setStrictMode(!!result.strictMode);
        setReviewDismissCount(result.reviewDismissCount as number);

        const newCount = (result.blockedPageViewCount as number) + 1;

        // Increment blocked page view count
        await chrome.storage.sync.set({ blockedPageViewCount: newCount });

        // Check if we should show review request
        if (
          !(result.reviewDismissedPermanently as boolean) &&
          shouldShowReview(newCount, 4)
        ) {
          setShowReviewRequest(true);
        }
      }
    );

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
    // Check if this is the first time creating a reminder and increment count
    const result = await chrome.storage.sync.get({
      hasCreatedFirstReminder: false,
      reminderCount: 0,
      reviewDismissCount: 0,
      reviewDismissedPermanently: false,
    });
    const isFirstReminder = !result.hasCreatedFirstReminder;

    await chrome.runtime.sendMessage({
      type: 'ADD_TODO_REMINDER',
      url: blockedUrl,
      note: todoNote.trim() || undefined,
    });

    // Increment reminder count
    const newReminderCount = (result.reminderCount as number) + 1;
    await chrome.storage.sync.set({ reminderCount: newReminderCount });

    // Check if we should show review request after saving reminder
    const shouldShowReviewAfterReminder =
      !(result.reviewDismissedPermanently as boolean) &&
      shouldShowReview(newReminderCount, 2);

    if (shouldShowReviewAfterReminder) {
      // Show review request instead of "Reminder Saved!" + close
      setReviewDismissCount(result.reviewDismissCount as number);
      setShowReviewRequest(true);
      setTodoSaved(true); // Still set this so we know to handle close after review
      return;
    }

    // Show saved confirmation
    setTodoSaved(true);

    // After showing confirmation, handle navigation
    setTimeout(async () => {
      if (isFirstReminder) {
        // Mark that user has created their first reminder
        await chrome.storage.sync.set({ hasCreatedFirstReminder: true });

        // Open options page with highlight parameter in URL
        console.log(
          '🎉 First reminder! Opening options page to show where reminders go'
        );
        const optionsUrl =
          chrome.runtime.getURL('src/options/options.html') +
          '?highlightTodos=true';
        chrome.tabs.create({ url: optionsUrl });
      }

      // Close current tab
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      }
    }, 1300);
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

  const handleReviewClick = () => {
    // Open review URL
    window.open(
      'https://chromewebstore.google.com/detail/focus-shield-ai-site-dist/ibmmihgadnkilmknmfmohlclogcifboj/reviews',
      '_blank'
    );
    setShowReviewRequest(false);

    // If we were showing review after saving todo, now close the tab
    if (todoSaved) {
      setTimeout(async () => {
        const tab = await chrome.tabs.getCurrent();
        if (tab?.id) {
          chrome.tabs.remove(tab.id);
        }
      }, 300);
    }
  };

  const handleReviewMaybeLater = async () => {
    // Increment dismiss count
    const newDismissCount = reviewDismissCount + 1;
    await chrome.storage.sync.set({ reviewDismissCount: newDismissCount });
    setShowReviewRequest(false);

    // If we were showing review after saving todo, now close the tab
    if (todoSaved) {
      setTimeout(async () => {
        const tab = await chrome.tabs.getCurrent();
        if (tab?.id) {
          chrome.tabs.remove(tab.id);
        }
      }, 1300);
    }
  };

  const handleReviewDontAskAgain = async () => {
    // Permanently dismiss
    await chrome.storage.sync.set({ reviewDismissedPermanently: true });
    setShowReviewRequest(false);

    // If we were showing review after saving todo, now close the tab
    if (todoSaved) {
      setTimeout(async () => {
        const tab = await chrome.tabs.getCurrent();
        if (tab?.id) {
          chrome.tabs.remove(tab.id);
        }
      }, 1300);
    }
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
          Blocked:{' '}
          <span className="text-muted-foreground line-clamp-2 block">
            {displayUrl}
          </span>
        </p>

        {showReviewRequest ? (
          // Review request
          <ReviewRequestCard
            dismissCount={reviewDismissCount}
            onReview={handleReviewClick}
            onMaybeLater={handleReviewMaybeLater}
            onDontAskAgain={handleReviewDontAskAgain}
          />
        ) : todoSaved ? (
          // Success confirmation
          <div className="mb-8 p-6 bg-emerald-100 dark:bg-emerald-950 rounded-lg text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              Reminder Saved!
            </h2>
          </div>
        ) : loading && !aiResponse ? (
          // Loading skeleton
          <>
            <div className="mb-8 p-6 bg-muted rounded-lg text-left">
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
