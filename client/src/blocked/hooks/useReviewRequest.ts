import { useState } from 'react';

interface UseReviewRequestProps {
  todoSaved: boolean;
}

export function useReviewRequest({ todoSaved }: UseReviewRequestProps) {
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [reviewDismissCount, setReviewDismissCount] = useState(0);

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

  return {
    showReviewRequest,
    setShowReviewRequest,
    reviewDismissCount,
    setReviewDismissCount,
    handleReviewClick,
    handleReviewMaybeLater,
    handleReviewDontAskAgain,
  };
}
