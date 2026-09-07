import { Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MONTHS = [
  { num: 1, name: "January", short: "Jan" },
  { num: 2, name: "February", short: "Feb" },
  { num: 3, name: "March", short: "Mar" },
  { num: 4, name: "April", short: "Apr" },
  { num: 5, name: "May", short: "May" },
  { num: 6, name: "June", short: "Jun" },
  { num: 7, name: "July", short: "Jul" },
  { num: 8, name: "August", short: "Aug" },
  { num: 9, name: "September", short: "Sep" },
  { num: 10, name: "October", short: "Oct" },
  { num: 11, name: "November", short: "Nov" },
  { num: 12, name: "December", short: "Dec" },
];

interface Props {
  value: number | null;
  onChange: (month: number) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const MonthOfBirthPicker = ({ value, onChange, onContinue, onBack }: Props) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
        <Calendar className="h-6 w-6 text-primary shrink-0" />
        <div>
          <p className="font-semibold text-base">Which month were you born?</p>
          <p className="text-sm text-muted-foreground">Tap your birth month</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MONTHS.map((m) => {
          const isSelected = value === m.num;
          return (
            <button
              key={m.num}
              type="button"
              onClick={() => onChange(m.num)}
              className={cn(
                "relative h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all active:scale-95",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {isSelected && (
                <Check className="absolute top-1.5 right-1.5 h-4 w-4 text-primary" />
              )}
              <span
                className={cn(
                  "text-base",
                  isSelected ? "font-bold text-primary" : "font-semibold",
                )}
              >
                {m.short}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {m.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 h-12"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={!value}
          className="flex-1 h-12"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
