import { Switch } from '@/components/ui/switch';

interface StrictModeToggleProps {
  strictMode: boolean;
  onChange: (enabled: boolean) => void;
}

export default function StrictModeToggle({
  strictMode,
  onChange,
}: StrictModeToggleProps) {
  return (
    <section className="p-4 rounded-lg border bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
            Strict Mode
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Block all sites except those in the always allowed list
          </p>
        </div>
        <Switch
          checked={strictMode}
          onCheckedChange={onChange}
          className="data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500"
        />
      </div>
    </section>
  );
}
