interface SiteListInputProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}

export default function SiteListInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 5,
}: SiteListInputProps) {
  return (
    <section className="mb-6">
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
        {label}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {description}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        placeholder={placeholder}
      />
    </section>
  );
}
