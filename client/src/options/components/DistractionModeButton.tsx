import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface DistractionModeButtonProps {
  todoRemindersCount: number;
  distractionModeExpiry: number | null;
  onEnable: () => void;
  onDisable: () => void;
}

function formatTimeRemaining(expiryTime: number): string {
  const remaining = Math.max(0, expiryTime - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function DistractionModeButton({
  todoRemindersCount,
  distractionModeExpiry,
  onEnable,
  onDisable,
}: DistractionModeButtonProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const isActive =
    distractionModeExpiry !== null && distractionModeExpiry > Date.now();

  useEffect(() => {
    if (!isActive || !distractionModeExpiry) return;

    const updateTimer = () => {
      const remaining = distractionModeExpiry - Date.now();
      if (remaining <= 0) {
        setTimeRemaining('');
        return;
      }
      setTimeRemaining(formatTimeRemaining(distractionModeExpiry));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isActive, distractionModeExpiry]);

  if (todoRemindersCount === 0) {
    return null;
  }

  return (
    <section className="p-4 rounded-lg border bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-0.5">
            Distraction Mode
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {isActive
              ? `Todo reminder sites accessible for ${timeRemaining}`
              : `Access all ${todoRemindersCount} of these sites for 10 mins`}
          </p>
        </div>
        {isActive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisable}
            className="border border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEnable}
            className="border border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            Enable
          </Button>
        )}
      </div>
    </section>
  );
}
