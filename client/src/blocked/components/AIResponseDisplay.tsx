import { useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FORM_WIDTH } from '../constants';

interface AIResponse {
  valid: boolean | null;
  seconds: number;
  message: string;
  followUpQuestion?: string | null;
}

interface AIResponseDisplayProps {
  aiResponse: AIResponse;
  reason: string;
  formatTime: (seconds: number) => string;
  onConfirmUnblock: () => void;
  onReset: () => void;
  onAddToTodo: () => void;
  onGoBack: () => void;
  onReplyToDenial?: (reply: string) => void;
  loading?: boolean;
}

// Simple markdown parser for **bold** text and newlines
function parseMarkdown(text: string): React.ReactNode {
  const lines = text.split(/\n/);
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const parsedLine = parts.map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={partIndex} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
    return (
      <span key={lineIndex}>
        {parsedLine}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
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
  onReplyToDenial,
  loading,
}: AIResponseDisplayProps) {
  const [replyText, setReplyText] = useState('');

  const handleSubmitReply = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (replyText.trim() && onReplyToDenial) {
      onReplyToDenial(replyText);
    }
  };

  return (
    <>
      {/* AI Response Display */}
      <div className={`mb-8 p-6 bg-muted rounded-lg text-left ${FORM_WIDTH}`}>
        <div className="flex items-start gap-3">
          <div className="text-3xl">{aiResponse.valid ? '✅' : '❌'}</div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {aiResponse.valid ? 'Approved' : 'Denied'}
              {reason ? ` ${reason}` : ''}
            </h2>
            <p className="text-foreground text-lg leading-relaxed">
              {parseMarkdown(aiResponse.message)}
            </p>
            {aiResponse.valid && (
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-3 text-lg">
                Time allocated: {formatTime(aiResponse.seconds)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 w-full">
        {aiResponse.valid ? (
          <>
            <Button
              onClick={onReset}
              variant="secondary"
              size="lg"
              className="flex-1"
            >
              Try again
            </Button>
            <Button
              onClick={onConfirmUnblock}
              variant="default"
              size="lg"
              className="flex-1"
            >
              Unblock {formatTime(aiResponse.seconds)}
              <CornerDownLeft size={18} className="opacity-60" />
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            {/* Reply input for denied requests */}
            {onReplyToDenial && (
              <form onSubmit={handleSubmitReply} className="w-full">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Add context... (e.g. 'Actually this is urgent because...')"
                  className="w-full p-3 text-base border rounded-lg bg-background text-foreground"
                  disabled={loading}
                  autoFocus
                />
              </form>
            )}
            <div className="flex gap-3">
              <Button
                onClick={onGoBack}
                variant="secondary"
                size="lg"
                className="flex-1"
              >
                Go Back
              </Button>
              {replyText.trim() && onReplyToDenial ? (
                <Button
                  onClick={() => handleSubmitReply()}
                  variant="default"
                  size="lg"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? 'Checking...' : 'Submit'}
                </Button>
              ) : (
                <Button
                  onClick={onAddToTodo}
                  variant="default"
                  size="lg"
                  className="flex-1"
                >
                  Create Reminder
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
