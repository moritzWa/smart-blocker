import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Check, Pin, Settings, Eye, Rocket } from 'lucide-react';

export default function Onboarding() {
  const [isPinned, setIsPinned] = useState(false);
  const [showNotPinnedMessage, setShowNotPinnedMessage] = useState(false);
  const [showNoBlockedSitesMessage, setShowNoBlockedSitesMessage] =
    useState(false);
  const [firstBlockedSite, setFirstBlockedSite] = useState<string | null>(null);

  useEffect(() => {
    // Check if extension is already pinned
    if (chrome.action && chrome.action.getUserSettings) {
      chrome.action.getUserSettings().then((settings) => {
        setIsPinned(settings.isOnToolbar || false);
      });
    }

    // Fetch first blocked site
    chrome.storage.sync.get(['blockedSites']).then((result) => {
      const blockedSites = result.blockedSites as string[] | undefined;
      if (blockedSites && blockedSites.length > 0) {
        // Extract just the domain name (remove protocol, www, paths, etc)
        const domain = blockedSites[0]
          .replace(/^(https?:\/\/)?(www\.)?/, '')
          .split('/')[0];
        setFirstBlockedSite(domain);
      }
    });
  }, []);

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleCheckPin = () => {
    if (chrome.action && chrome.action.getUserSettings) {
      chrome.action.getUserSettings().then((settings) => {
        const pinned = settings.isOnToolbar || false;
        setIsPinned(pinned);

        // Show "not pinned" message if still not pinned
        if (!pinned) {
          setShowNotPinnedMessage(true);
          // Hide message after 3 seconds
          setTimeout(() => setShowNotPinnedMessage(false), 3000);
        }
      });
    }
  };

  const handleTryItOut = async () => {
    if (!firstBlockedSite) {
      setShowNoBlockedSitesMessage(true);
      setTimeout(() => setShowNoBlockedSitesMessage(false), 3000);
      return;
    }

    try {
      const result = await chrome.storage.sync.get(['blockedSites']);
      const blockedSites = result.blockedSites as string[] | undefined;

      if (!blockedSites || blockedSites.length === 0) {
        setShowNoBlockedSitesMessage(true);
        setTimeout(() => setShowNoBlockedSitesMessage(false), 3000);
        return;
      }

      // Open the first blocked site in a new tab
      const site = blockedSites[0];
      // Add https:// if not present
      const url = site.startsWith('http') ? site : `https://${site}`;
      chrome.tabs.create({ url });
    } catch (error) {
      console.error('Error opening blocked site:', error);
      setShowNoBlockedSitesMessage(true);
      setTimeout(() => setShowNoBlockedSitesMessage(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-sans">
      <div className="text-center max-w-6xl px-10 py-12">
        <img
          src="/logo.png"
          alt="Focus Shield"
          className="w-32 h-32 mx-auto mb-6"
        />

        <h1 className="text-5xl font-bold text-foreground mb-4">
          Welcome to Focus Shield!
        </h1>

        <p className="text-xl text-muted-foreground mb-12">
          Let's get you set up in 4 quick steps
        </p>

        <div className="space-y-12">
          {/* Step 1: Pin Extension */}
          <div className="text-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isPinned ? 'bg-green-500' : 'bg-primary'
              }`}
            >
              {isPinned ? (
                <Check className="text-white" size={24} />
              ) : (
                <Pin className="text-primary-foreground" size={24} />
              )}
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Step 1: Pin the Extension
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
              Pin it to see a countdown badge showing how many minutes you have
              left before auto-reblock, and to quickly access the settings.
            </p>
            <div className="max-w-3xl mx-auto mb-4">
              <img
                src="/images/onboarding/pin-extension.gif"
                alt="How to pin Focus Shield extension"
                className="w-full h-auto rounded-lg border border-border"
                onError={(e) => {
                  // Fallback if GIF doesn't exist yet
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML =
                    '<div class="bg-muted p-8 rounded-lg"><p class="text-muted-foreground">Add pin-extension.gif to /images/onboarding/</p></div>';
                }}
              />
            </div>
            {!isPinned && (
              <div className="space-y-2">
                <Button onClick={handleCheckPin} variant="secondary" size="sm">
                  I've pinned it! Check status
                </Button>
                {showNotPinnedMessage && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Not pinned yet. Please pin the extension using the guide above.
                  </p>
                )}
              </div>
            )}
            {isPinned && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 justify-center">
                <Check size={18} />
                <span className="font-semibold">Extension is pinned!</span>
              </div>
            )}
          </div>

          <div className="border-t border-border"></div>

          {/* Step 2: Product Overview */}
          <div className="text-center">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="text-primary-foreground" size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Step 2: See How It Works
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
              Explain why you need to access distracting sites. AI will grant
              you access for a specific duration. Sites auto-reblock when time
              expires.
            </p>
            <Carousel className="w-[90%] max-w-5xl mx-auto">
              <CarouselContent>
                <CarouselItem>
                  <div className="p-1">
                    <div className="flex aspect-video items-center justify-center rounded-lg">
                      <img
                        src="/images/onboarding/core-flow.png"
                        alt="Focus Shield Core Flow"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          // Fallback if image doesn't exist yet
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML =
                            '<p class="text-muted-foreground">Core Flow - Add core-flow.png to /images/onboarding/</p>';
                        }}
                      />
                    </div>
                  </div>
                </CarouselItem>
                <CarouselItem>
                  <div className="p-1">
                    <div className="flex aspect-video items-center justify-center rounded-lg">
                      <img
                        src="/images/onboarding/dark-mode-and-strict-mode.png"
                        alt="Focus Shield Dark Mode and Strict Mode"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML =
                            '<p class="text-muted-foreground">Dark Mode & Strict Mode - Add dark-mode-and-strict-mode.png to /images/onboarding/</p>';
                        }}
                      />
                    </div>
                  </div>
                </CarouselItem>
                <CarouselItem>
                  <div className="p-1">
                    <div className="flex aspect-video items-center justify-center rounded-lg">
                      <img
                        src="/images/onboarding/save-as-todo.png"
                        alt="Focus Shield Save as Todo"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML =
                            '<p class="text-muted-foreground">Save as Todo - Add save-as-todo.png to /images/onboarding/</p>';
                        }}
                      />
                    </div>
                  </div>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>

          <div className="border-t border-border"></div>

          {/* Step 3: Customize Blocked Sites */}
          <div className="text-center">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="text-primary-foreground" size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Step 3: Customize Your Blocked Sites
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
              Configure which sites to block and which to allow. We've set up
              some common defaults, but you can customize them to fit your
              needs.
            </p>
            <Button
              onClick={handleOpenSettings}
              variant="default"
              size="default"
            >
              <Settings size={18} className="mr-2" />
              Open Settings
            </Button>
          </div>

          <div className="border-t border-border"></div>

          {/* Step 4: Try It Out */}
          <div className="text-center">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Rocket className="text-primary-foreground" size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Step 4: Try It Out Now
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
              Click below to open a blocked site and see Focus Shield in action!
            </p>
            <div className="space-y-2">
              <Button
                onClick={handleTryItOut}
                variant="default"
                size="default"
                disabled={!firstBlockedSite}
              >
                <Rocket size={18} className="mr-2" />
                {firstBlockedSite
                  ? `Try opening ${firstBlockedSite}`
                  : 'Loading...'}
              </Button>
              {showNoBlockedSitesMessage && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No blocked sites found. Please add some in Settings first.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <p className="text-sm text-muted-foreground">
            You're all set! Close this tab when you're ready.
          </p>
        </div>
      </div>
    </div>
  );
}
