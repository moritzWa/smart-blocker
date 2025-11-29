import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FORM_WIDTH } from '../constants';

interface TodoReminderFormProps {
  todoNote: string;
  setTodoNote: (note: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function TodoReminderForm({
  todoNote,
  setTodoNote,
  onSave,
  onCancel,
}: TodoReminderFormProps) {
  // Handle Enter key to save
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSave]);

  return (
    <div className={FORM_WIDTH}>
      <label className="block mb-4 text-muted-foreground font-medium text-lg">
        Optional note:
      </label>
      <Input
        type="text"
        autoFocus={true}
        value={todoNote}
        onChange={(e) => setTodoNote(e.target.value)}
        placeholder="Context for your reminder"
        className="mb-4"
      />
      <div className="flex gap-3 w-full">
        <Button onClick={onCancel} variant="secondary" className="flex-1">
          Cancel
        </Button>
        <Button onClick={onSave} variant="default" className="flex-1">
          Save Todo Reminder
        </Button>
      </div>
    </div>
  );
}
