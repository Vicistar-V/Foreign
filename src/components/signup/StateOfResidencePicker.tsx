import { useState, useMemo } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { NIGERIAN_STATES_ALPHA } from '@/lib/nigerianStates';

interface Props {
  value: string | null;
  onChange: (state: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const StateOfResidencePicker = ({ value, onChange, onContinue, onBack }: Props) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NIGERIAN_STATES_ALPHA;
    return NIGERIAN_STATES_ALPHA.filter(
      (s) => s.name.toLowerCase().includes(q) || s.zone.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
        <MapPin className="h-6 w-6 text-primary shrink-0" />
        <div>
          <p className="font-semibold text-base">Which state do you live in?</p>
          <p className="text-sm text-muted-foreground">
            Pick the state where you're staying now
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your state (e.g. Lagos)"
          className="pl-9 h-11"
          autoComplete="off"
        />
      </div>

      <div className="max-h-[280px] overflow-y-auto rounded-xl border border-border divide-y divide-border">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No state matches "{query}"
          </div>
        )}
        {filtered.map((s) => {
          const isSelected = value === s.name;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onChange(s.name)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-left transition-colors active:bg-primary/10',
                isSelected ? 'bg-primary/10' : 'bg-card hover:bg-muted/50',
              )}
            >
              <div>
                <p
                  className={cn(
                    'text-sm',
                    isSelected ? 'font-bold text-primary' : 'font-medium',
                  )}
                >
                  {s.name}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.zone}</p>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1 h-12">
          Back
        </Button>
        <Button type="button" onClick={onContinue} disabled={!value} className="flex-1 h-12">
          Continue
        </Button>
      </div>
    </div>
  );
};
