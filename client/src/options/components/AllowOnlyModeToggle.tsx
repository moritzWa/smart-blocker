interface AllowOnlyModeToggleProps {
  allowOnlyMode: boolean;
  onChange: (enabled: boolean) => void;
}

export default function AllowOnlyModeToggle({
  allowOnlyMode,
  onChange,
}: AllowOnlyModeToggleProps) {
  return (
    <section className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-1">
            Allow-Only Mode
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Block all sites except those in the allowed list
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={allowOnlyMode}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
        </label>
      </div>
    </section>
  );
}
