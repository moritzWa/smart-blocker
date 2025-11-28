import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReviewRequestCardProps {
  dismissCount: number;
  onReview: () => void;
  onMaybeLater: () => void;
  onDontAskAgain: () => void;
}

export default function ReviewRequestCard({
  dismissCount,
  onReview,
  onMaybeLater,
  onDontAskAgain,
}: ReviewRequestCardProps) {
  const showDontAskAgain = dismissCount >= 3;

  return (
    <div className="text-center">
      <div className="mb-6 p-6 bg-muted rounded-lg">
        <Heart className="w-12 h-12 mx-auto mb-3 text-rose-500 fill-rose-500" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Enjoying Focus Shield?
        </h2>
        <p className="text-muted-foreground text-lg">
          A review would mean a lot to me! It helps others discover Focus
          Shield and be as locked in as you are right now.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={onReview}
          variant="default"
          size="lg"
          className="w-full"
        >
          Leave a Review
        </Button>

        <div className="flex gap-3">
          <Button
            onClick={onMaybeLater}
            variant="secondary"
            size="lg"
            className="flex-1"
          >
            Maybe Later
          </Button>

          {showDontAskAgain && (
            <Button
              onClick={onDontAskAgain}
              variant="ghost"
              size="lg"
              className="flex-1"
            >
              Don't Ask Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
