import { Button } from '@/components/ui/button';

interface FooterLinksProps {
  showHistory: boolean;
  onToggleHistory: () => void;
  onReviewClick: () => void;
  onToggleImport: () => void;
  onSeedTodos?: () => void;
  onSeedAccessHistory?: () => void;
}

export default function FooterLinks({
  showHistory,
  onToggleHistory,
  onReviewClick,
  onToggleImport,
  onSeedTodos,
  onSeedAccessHistory,
}: FooterLinksProps) {
  return (
    <div className="flex gap-4 justify-center text-center flex-wrap mt-6">
      <Button
        variant="link"
        size="sm"
        className="cursor-pointer text-muted-foreground"
        onClick={onToggleHistory}
      >
        {showHistory ? 'Hide History' : 'Show History'}
      </Button>
      <Button
        variant="link"
        size="sm"
        className="cursor-pointer text-muted-foreground"
        onClick={onReviewClick}
      >
        Review Extension
      </Button>
      <Button
        variant="link"
        size="sm"
        className="cursor-pointer text-muted-foreground"
        onClick={() => {
          const onboardingUrl = chrome.runtime.getURL(
            'src/onboarding/onboarding.html'
          );
          chrome.tabs.create({ url: onboardingUrl });
        }}
      >
        View Onboarding
      </Button>
      <Button
        variant="link"
        size="sm"
        className="cursor-pointer text-muted-foreground"
        onClick={onToggleImport}
      >
        Import from SiteBlock
      </Button>
      <Button
        variant="link"
        size="sm"
        className="cursor-pointer text-muted-foreground"
        onClick={() => window.open('https://moritzw.com', '_blank')}
      >
        Made by Moritz W.
      </Button>
      {import.meta.env.DEV && onSeedTodos && (
        <Button
          variant="link"
          size="sm"
          className="cursor-pointer text-muted-foreground"
          onClick={onSeedTodos}
        >
          Seed Todos
        </Button>
      )}
      {import.meta.env.DEV && onSeedAccessHistory && (
        <Button
          variant="link"
          size="sm"
          className="cursor-pointer text-muted-foreground"
          onClick={onSeedAccessHistory}
        >
          Seed History
        </Button>
      )}
    </div>
  );
}
