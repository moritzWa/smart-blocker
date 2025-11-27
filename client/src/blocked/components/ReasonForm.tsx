import { type RefObject } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ReasonFormProps {
  reason: string;
  setReason: (reason: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onShowTodoInput: () => void;
  onGoBack: () => void;
}

export default function ReasonForm({
  reason,
  setReason,
  onSubmit,
  loading,
  error,
  inputRef,
  onShowTodoInput,
  onGoBack,
}: ReasonFormProps) {
  return (
    <>
      {/* Option 1: AI Validation */}
      <div className="mb-4">
        <label className="block mb-4 text-foreground font-medium text-lg">
          Why do you want to access this? Don't lie to yourself.
        </label>
        <Input
          ref={inputRef}
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="Why disrupt your focus?"
          disabled={loading}
        />
      </div>

      {error && <p className="text-destructive mb-4">{error}</p>}

      <Button
        onClick={onSubmit}
        disabled={!reason.trim() || loading}
        variant="default"
        className="w-full mb-4"
      >
        {loading ? 'Validating...' : 'Submit'}
        {!loading && <CornerDownLeft size={18} className="opacity-60" />}
      </Button>

      {/* Separator and alternative options */}
      <div className="border-t-2 border-border pt-4">
        <div className="flex gap-3">
          <Button
            onClick={onShowTodoInput}
            variant="default"
            className="flex-1"
          >
            Remind Me Later
          </Button>
          <Button
            onClick={onGoBack}
            disabled={loading}
            variant="secondary"
            className="flex-1"
          >
            Go Back
          </Button>
        </div>
      </div>
    </>
  );
}
