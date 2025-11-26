import { Switch } from '@/components/ui/switch';

interface AllowOnlyModeToggleProps {
  allowOnlyMode: boolean;
  onChange: (enabled: boolean) => void;
}

export default function AllowOnlyModeToggle({
  allowOnlyMode,
  onChange,
}: AllowOnlyModeToggleProps) {
  return (
    <section className="mb-6 p-4 bg-success/10 border border-success/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-1">
            Allow-Only Mode
          </h3>
          <p className="text-sm text-muted-foreground">
            Block all sites except those in the allowed list
          </p>
        </div>
        <Switch
          checked={allowOnlyMode}
          onCheckedChange={onChange}
        />
      </div>
    </section>
  );
}
