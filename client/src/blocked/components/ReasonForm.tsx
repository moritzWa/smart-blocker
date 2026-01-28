import { type RefObject } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FORM_WIDTH } from '../constants';
import { cn } from '@/lib/utils';

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
      <div className={cn(FORM_WIDTH, 'text-center')}>
        {/* Option 1: AI Validation */}
        <div className="mb-4">
          <Input
            ref={inputRef}
            type="text"
            value={reason}
            autoFocus={true}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="Why disrupt your focus?"
            disabled={loading}
          />
        </div>

        {error && <p className="text-destructive mb-4">{error}</p>}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onSubmit()}
                disabled={!reason.trim() || loading}
                variant="default"
                className="w-full mb-4"
              >
                Submit
                <CornerDownLeft size={18} className="opacity-60" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Press Enter to submit</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Separator and alternative options */}
        <div className={cn(FORM_WIDTH, 'border-t-2 border-border pt-4')}>
          <div className="flex gap-3 w-full">
            <Button
              onClick={onGoBack}
              disabled={loading}
              variant="secondary"
              className="flex-1"
            >
              Go Back
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onShowTodoInput}
                    variant="default"
                    className="flex-1"
                  >
                    Remind Me Later
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press ⌘S to remind later</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </>
  );
}
