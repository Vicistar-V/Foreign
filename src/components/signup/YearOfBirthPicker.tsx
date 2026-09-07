import { useState, useEffect, useRef } from "react";
import { Cake, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Year-of-birth picker — plain numeric input.
 *
 * Grandma test: don't make her pick from grids or steppers. Just let her
 * type the 4-digit year she was born. We show a live "about X years old"
 * confirmation so she can tell she typed it right before continuing.
 */
interface Props {
  value: number | null;
  onChange: (year: number) => void;
  onContinue: () => void;
}

const MIN_AGE = 13;
const MAX_AGE = 100;

export const YearOfBirthPicker = ({ value, onChange, onContinue }: Props) => {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - MAX_AGE;
  const maxYear = currentYear - MIN_AGE;

  const [text, setText] = useState<string>(value ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && String(value) !== text) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Autofocus on mount so mobile users see the keyboard immediately
  // and don't sit staring at an empty YYYY box wondering what to do.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const parsed = /^\d{4}$/.test(text) ? parseInt(text, 10) : null;
  const age = parsed ? currentYear - parsed : null;

  let error: string | null = null;
  if (text.length > 0 && text.length < 4) {
    error = "Type all 4 numbers of the year";
  } else if (parsed !== null) {
    if (parsed > maxYear) error = `You must be at least ${MIN_AGE} years old`;
    else if (parsed < minYear) error = "Please check the year again";
  }

  const isValid = parsed !== null && !error;

  const handleChange = (v: string) => {
    // digits only, max 4
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setText(clean);
    if (/^\d{4}$/.test(clean)) {
      const n = parseInt(clean, 10);
      if (n >= minYear && n <= maxYear) onChange(n);
    }
  };

  const handleSubmit = () => {
    if (isValid) onContinue();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
        <Cake className="h-6 w-6 text-primary shrink-0" />
        <div>
          <p className="font-semibold text-base">What year were you born?</p>
          <p className="text-sm text-muted-foreground">
            Type the 4-digit year (like 1985)
          </p>
        </div>
      </div>

      {/* Big year input */}
      <div>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="bday-year"
          placeholder="YYYY"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className={cn(
            "w-full h-20 rounded-2xl border-2 bg-card text-center",
            "text-5xl font-black tabular-nums tracking-widest",
            "outline-none transition-all",
            error
              ? "border-destructive focus:border-destructive"
              : isValid
              ? "border-primary focus:border-primary"
              : "border-border focus:border-primary",
          )}
          maxLength={4}
        />

        {/* Live feedback line — always reserves space so layout doesn't jump */}
        <div className="min-h-[1.5rem] mt-2 text-center text-sm">
          {error ? (
            <span className="text-destructive inline-flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </span>
          ) : isValid && age !== null ? (
            <span className="text-muted-foreground">
              About <span className="font-bold text-foreground tabular-nums">{age}</span> years old
            </span>
          ) : (
            <span className="text-muted-foreground">Example: 1985</span>
          )}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full h-12 text-base"
      >
        Continue
      </Button>
    </div>
  );
};
