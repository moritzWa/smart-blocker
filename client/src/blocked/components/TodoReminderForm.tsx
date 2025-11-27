import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  return (
    <div>
      <label className="block mb-4 text-foreground font-medium text-lg">
        Optional note:
      </label>
      <Input
        type="text"
        autoFocus={true}
        value={todoNote}
        onChange={(e) => setTodoNote(e.target.value)}
        placeholder="Why do you want to access this later?"
        className="mb-4"
      />
      <div className="flex gap-3">
        <Button onClick={onSave} variant="default" className="flex-1">
          Save Todo Reminder
        </Button>
        <Button onClick={onCancel} variant="secondary" className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
