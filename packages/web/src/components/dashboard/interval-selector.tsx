import type { ActivityInterval } from '@/lib/api/user-activity';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IntervalSelectorProps {
  value: ActivityInterval;
  onChange: (value: ActivityInterval) => void;
}

const options: Array<{ label: string; value: ActivityInterval }> = [
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
];

export function IntervalSelector({ value, onChange }: IntervalSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ActivityInterval)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
