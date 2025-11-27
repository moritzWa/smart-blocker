import { CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIResponse {
  valid: boolean;
  seconds: number;
  message: string;
}

interface AIResponseDisplayProps {
  aiResponse: AIResponse;
  reason: string;
  formatTime: (seconds: number) => string;
  onConfirmUnblock: () => void;
  onReset: () => void;
  onAddToTodo: () => void;
  onGoBack: () => void;
}

// Simple markdown parser for **bold** text
function parseBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold">
          {boldText}
        </strong>
      );
    }
    return part;
  });
}

export default function AIResponseDisplay({
  aiResponse,
  reason,
  formatTime,
  onConfirmUnblock,
  onReset,
  onAddToTodo,
  onGoBack,
}: AIResponseDisplayProps) {
  return (
    <>
      {/* AI Response Display */}
      <div className="mb-8 p-6 bg-muted rounded-lg text-left w-[424px] mx-auto">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl">{aiResponse.valid ? '✅' : '❌'}</div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {aiResponse.valid ? 'Approved' : 'Denied'}
              {reason ? ` ${reason}` : ''}
            </h2>
            <p className="text-foreground text-lg leading-relaxed">
              {parseBoldMarkdown(aiResponse.message)}
            </p>
            {aiResponse.valid && (
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-3 text-lg">
                Time allocated: {formatTime(aiResponse.seconds)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 justify-center">
        {aiResponse.valid ? (
          <>
            <Button onClick={onReset} variant="secondary" size="lg">
              Try different reason
            </Button>
            <Button onClick={onConfirmUnblock} variant="default" size="lg">
              Unblock for {formatTime(aiResponse.seconds)}
              <CornerDownLeft size={18} className="opacity-60" />
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onGoBack} variant="secondary" size="lg">
              Go Back
            </Button>
            <Button onClick={onAddToTodo} variant="default" size="lg">
              Create Reminder
            </Button>
          </>
        )}
      </div>
    </>
  );
}
