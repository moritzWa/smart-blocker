import { useRef, useEffect, useState } from 'react';
import { X, Copy, Pencil, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DistractionModeButton from './DistractionModeButton';

interface TodoReminder {
  id: string;
  url: string;
  hostname: string;
  note?: string;
  timestamp: number;
}

interface TodoRemindersListProps {
  todoReminders: TodoReminder[];
  onRemove: (id: string) => void;
  onEdit: (id: string, note: string) => void;
  onOpen: (url: string) => void;
  onCopy: () => void;
  highlight?: boolean;
  distractionModeExpiry: number | null;
  onEnableDistractionMode: () => void;
  onDisableDistractionMode: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

const DEFAULT_VISIBLE_COUNT = 4;

export default function TodoRemindersList({
  todoReminders,
  onRemove,
  onEdit,
  onOpen,
  onCopy,
  highlight = false,
  distractionModeExpiry,
  onEnableDistractionMode,
  onDisableDistractionMode,
  expanded,
  onToggleExpanded,
}: TodoRemindersListProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [, forceUpdate] = useState(0);

  // Re-render after 3s to clear "new item" highlights
  useEffect(() => {
    const hasNewItems = todoReminders.some(
      (r) => Date.now() - r.timestamp < 3000
    );
    if (hasNewItems) {
      const timer = setTimeout(() => forceUpdate((n) => n + 1), 3000);
      return () => clearTimeout(timer);
    }
  }, [todoReminders]);

  // Scroll to and highlight on first reminder creation
  useEffect(() => {
    if (highlight && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlight]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  if (todoReminders.length === 0) {
    return null;
  }

  // Helper to format URL like in BlockedPage
  const formatDisplayUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  const handleStartEdit = (reminder: TodoReminder) => {
    setEditingId(reminder.id);
    setEditNote(reminder.note || '');
  };

  const handleSaveEdit = () => {
    if (editingId) {
      onEdit(editingId, editNote.trim());
      setEditingId(null);
      setEditNote('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNote('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <Card
      ref={sectionRef}
      className={`rounded-xl ${highlight ? 'animate-pulse-purple' : ''}`}
    >
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            To-Do Reminders
          </h2>
          <Button
            onClick={onCopy}
            variant="ghost"
            size="sm"
            title="Copy to clipboard"
          >
            <Copy size={14} />
            Copy
          </Button>
        </div>
        <DistractionModeButton
          todoRemindersCount={todoReminders.length}
          distractionModeExpiry={distractionModeExpiry}
          onEnable={onEnableDistractionMode}
          onDisable={onDisableDistractionMode}
        />
        <div className="space-y-2">
          {(expanded
            ? todoReminders
            : todoReminders.slice(0, DEFAULT_VISIBLE_COUNT)
          ).map((reminder) => {
            const displayUrl = formatDisplayUrl(reminder.url);
            const isEditing = editingId === reminder.id;

            const isNew = Date.now() - reminder.timestamp < 3000;

            return (
              <div
                key={reminder.id}
                className={`flex items-center gap-3 group hover:bg-muted px-2 py-1.5 rounded-sm transition-colors ${
                  isNew ? 'animate-pulse-purple-intense' : ''
                }`}
              >
                {isEditing ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0">□</span>
                    <Input
                      ref={inputRef}
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Note (optional)"
                      className="h-7 text-sm"
                    />
                    <span className="font-mono text-xs text-muted-foreground truncate min-w-0 shrink-0 max-w-[150px]">
                      {displayUrl}
                    </span>
                  </div>
                ) : (
                  <div
                    onClick={() => onOpen(reminder.url)}
                    className="flex-1 min-w-0 text-left h-auto p-0 hover:bg-transparent group/item cursor-pointer"
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0">□</span>
                      {reminder.note ? (
                        <>
                          <span className="text-foreground text-sm group-hover/item:text-primary transition-colors shrink-0">
                            {reminder.note}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground truncate min-w-0">
                            {displayUrl}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-sm text-foreground group-hover/item:text-primary truncate min-w-0 transition-colors">
                          {displayUrl}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {isEditing ? (
                  <Button
                    onClick={handleSaveEdit}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    title="Save"
                  >
                    <Check size={16} />
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handleStartEdit(reminder)}
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      onClick={() => onRemove(reminder.id)}
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
                      title="Remove"
                    >
                      <X size={16} />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
          {todoReminders.length > DEFAULT_VISIBLE_COUNT && (
            <Button
              onClick={onToggleExpanded}
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp size={16} className="mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown size={16} className="mr-1" />
                  Show {todoReminders.length - DEFAULT_VISIBLE_COUNT} more
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
