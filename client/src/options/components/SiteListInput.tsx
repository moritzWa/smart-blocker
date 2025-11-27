import { Textarea } from '@/components/ui/textarea';

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
    <section>
      <h2 className="text-xl font-semibold text-foreground mb-2">{label}</h2>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
    </section>
  );
}
