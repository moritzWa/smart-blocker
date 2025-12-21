import { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import ReasonForm from './components/ReasonForm';
import TodoReminderForm from './components/TodoReminderForm';
import AIResponseDisplay from './components/AIResponseDisplay';
import ReviewRequestCard from './components/ReviewRequestCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useFaviconStrictMode } from '@/hooks/useFaviconStrictMode';
import { useReviewRequest } from './hooks/useReviewRequest';
import { shouldShowReview, formatTime, parseMarkdown } from './utils';
import { FORM_WIDTH } from './constants';

interface AIResponse {
  valid: boolean | null;
  seconds: number;
  message: string;
  followUpQuestion?: string | null;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SiteMetadata {
  title: string;
  description: string;
}

interface AccessAttempt {
  id: string;
  domain: string;
  reason: string;
  timestamp: number;
  outcome: 'approved' | 'rejected' | 'reminder' | 'abandoned';
  durationSeconds?: number;
  aiMessage?: string;
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
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [siteMetadata, setSiteMetadata] = useState<SiteMetadata | null>(null);
  const [accessHistory, setAccessHistory] = useState<AccessAttempt[]>([]);
  const [strictMode, setStrictMode] = useState(false);
  const [todoSaved, setTodoSaved] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);

  // Review request logic
  const {
    showReviewRequest,
    setShowReviewRequest,
    reviewDismissCount,
    setReviewDismissCount,
    handleReviewClick,
    handleReviewMaybeLater,
    handleReviewDontAskAgain,
  } = useReviewRequest({ todoSaved });

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

    // Fetch site metadata in background
    if (url) {
      chrome.runtime.sendMessage({ type: 'GET_SITE_METADATA', url }).then((metadata) => {
        if (metadata) {
          setSiteMetadata(metadata);
          console.log('📄 Got site metadata:', metadata);
        }
      });

      // Fetch access history for this domain
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        chrome.runtime.sendMessage({ type: 'GET_ACCESS_HISTORY', domain, hoursBack: 24 }).then((history) => {
          if (history) {
            setAccessHistory(history);
            console.log('📊 Got access history:', history);
          }
        });
      } catch {
        // ignore URL parse errors
      }
    }

    // Register this session with the service worker
    chrome.tabs.getCurrent().then((tab) => {
      if (tab?.id) {
        setTabId(tab.id);
        const domain = url ? new URL(url).hostname.replace(/^www\./, '') : '';
        chrome.runtime.sendMessage({
          type: 'REGISTER_BLOCKED_SESSION',
          tabId: tab.id,
          domain,
        });
        console.log(`📝 Registered blocked session for tab ${tab.id}`);
      }
    });

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

  // Update session in service worker when conversation changes
  useEffect(() => {
    if (tabId && conversationHistory.length > 0) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SESSION',
        tabId,
        conversationHistory,
        lastAiMessage: aiResponse?.message || aiResponse?.followUpQuestion,
      });
    }
  }, [tabId, conversationHistory, aiResponse]);

  // Handle Cmd+S to trigger "Remind Me Later"
  useEffect(() => {
    // Only work when showing reason form (not todo input, not AI response, not loading)
    if (showTodoInput || aiResponse || loading) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // Prevent browser's Save dialog
        setShowTodoInput(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showTodoInput, aiResponse, loading]);

  const handleSubmitReason = async (messageToSend?: string) => {
    const textToSend = messageToSend ?? reason;
    if (!textToSend.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'VALIDATE_REASON',
        hostname: displayUrl,
        reason: textToSend,
        conversationHistory,
        siteMetadata,
        accessHistory,
      });

      if ('error' in response) {
        setError(response.error);
      } else {
        // Update conversation history
        const newHistory: ConversationMessage[] = [
          ...conversationHistory,
          { role: 'user', content: textToSend },
        ];
        // Add AI response to history (follow-up question or rejection message)
        if (response.followUpQuestion) {
          newHistory.push({ role: 'assistant', content: response.followUpQuestion });
        } else if (response.valid === false && response.message) {
          // Include rejection message so AI has context if user appeals
          newHistory.push({ role: 'assistant', content: `[Rejected] ${response.message}` });
        }
        setConversationHistory(newHistory);
        setAiResponse(response);
        setFollowUpAnswer('');
      }
    } catch (err) {
      setError('Failed to connect to validation service');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFollowUp = () => {
    if (!followUpAnswer.trim()) return;
    handleSubmitReason(followUpAnswer);
  };

  const handleConfirmUnblock = async () => {
    if (!aiResponse?.valid) return;

    // Resolve the session as approved before navigating away
    if (tabId) {
      await chrome.runtime.sendMessage({
        type: 'RESOLVE_BLOCKED_SESSION',
        tabId,
        outcome: 'approved',
        durationSeconds: aiResponse.seconds,
      });
    }

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

  const handleSaveTodoReminder = async () => {
    // Resolve the session as reminder
    if (tabId) {
      await chrome.runtime.sendMessage({
        type: 'RESOLVE_BLOCKED_SESSION',
        tabId,
        outcome: 'reminder',
      });
    }

    const result = await chrome.storage.sync.get({
      reminderCount: 0,
      reviewDismissCount: 0,
      reviewDismissedPermanently: false,
    });

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
      setReviewDismissCount(result.reviewDismissCount as number);
      setShowReviewRequest(true);
      setTodoSaved(true);
      return;
    }

    // Show saved confirmation briefly, then redirect to options page
    setTodoSaved(true);

    setTimeout(async () => {
      // Always open options page with highlight
      const optionsUrl =
        chrome.runtime.getURL('src/options/options.html') +
        '?highlightTodos=true';
      chrome.tabs.create({ url: optionsUrl });

      // Close current tab
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      }
    }, 800);
  };

  const handleReset = () => {
    setAiResponse(null);
    setReason('');
    setError(null);
    setConversationHistory([]);
    setFollowUpAnswer('');
  };

  const handleGoBack = async () => {
    // Resolve session as abandoned if there was any conversation
    if (tabId && conversationHistory.length > 0) {
      await chrome.runtime.sendMessage({
        type: 'RESOLVE_BLOCKED_SESSION',
        tabId,
        outcome: 'abandoned',
      });
    }
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
          {strictMode ? 'Strict Mode' : 'Focus Shield'}
        </h1>

        <p
          className={`text-2xl mb-5 text-foreground ${FORM_WIDTH} flex justify-center gap-1 text-center`}
        >
          <span>Blocked:</span>
          <span className="text-muted-foreground truncate min-w-0">
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
          <div className={FORM_WIDTH}>
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
            <div className="flex gap-3 w-full">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 flex-1" />
            </div>
          </div>
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
        ) : aiResponse.valid === null && aiResponse.followUpQuestion ? (
          // Follow-up question
          <div className={FORM_WIDTH}>
            <div className="mb-6 p-5 bg-muted rounded-lg text-left">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🤔</div>
                <div className="flex-1">
                  <p className="text-foreground text-lg">{parseMarkdown(aiResponse.followUpQuestion)}</p>
                </div>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitFollowUp();
              }}
              className="w-full"
            >
              <input
                type="text"
                value={followUpAnswer}
                onChange={(e) => setFollowUpAnswer(e.target.value)}
                placeholder="Your answer..."
                className="w-full p-4 text-lg border rounded-lg mb-4 bg-background text-foreground"
                autoFocus
                disabled={loading}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 p-3 text-lg bg-secondary text-secondary-foreground rounded-lg"
                >
                  Start Over
                </button>
                <button
                  type="submit"
                  disabled={loading || !followUpAnswer.trim()}
                  className="flex-1 p-3 text-lg bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Checking...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <AIResponseDisplay
            aiResponse={aiResponse as AIResponse}
            reason={reason}
            formatTime={formatTime}
            onConfirmUnblock={handleConfirmUnblock}
            onReset={handleReset}
            onAddToTodo={handleAddToTodo}
            onGoBack={handleGoBack}
            onReplyToDenial={handleSubmitReason}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
