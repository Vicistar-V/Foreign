/**
 * Dismissible birthday edit dialog. Two steps: year then month.
 * Uses the save_my_birth_date RPC.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { YearOfBirthPicker } from "@/components/signup/YearOfBirthPicker";
import { MonthOfBirthPicker } from "@/components/signup/MonthOfBirthPicker";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Loader2, Cake } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initialYear?: number | null;
  initialMonth?: number | null;
}

export const BirthdayEditDialog = ({
  open,
  onOpenChange,
  userId,
  initialYear,
  initialMonth,
}: Props) => {
  const [step, setStep] = useState<"year" | "month">("year");
  const [year, setYear] = useState<number | null>(initialYear ?? null);
  const [month, setMonth] = useState<number | null>(initialMonth ?? null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setStep("year");
      setYear(initialYear ?? null);
      setMonth(initialMonth ?? null);
      setSaving(false);
    }
  }, [open, initialYear, initialMonth]);

  const handleSave = async () => {
    if (!year || !month) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_my_birth_date", {
      _birth_year: year,
      _birth_month: month,
    });
    if (error) {
      setSaving(false);
      toast({
        title: "Could not save",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profile", userId] });
    toast({ title: "Birthday saved" });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-md p-0 gap-0 rounded-2xl border-border max-h-[92vh] overflow-y-auto">
        <div className="p-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Cake className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base">Update your birthday</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Pick your birth year, then your birth month.
          </DialogDescription>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: step === "year" ? "50%" : "100%" }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Step {step === "year" ? "1" : "2"} of 2
          </p>
        </div>

        <div className="p-5">
          {step === "year" ? (
            <YearOfBirthPicker
              value={year}
              onChange={setYear}
              onContinue={() => setStep("month")}
            />
          ) : (
            <div className="space-y-3">
              <MonthOfBirthPicker
                value={month}
                onChange={setMonth}
                onContinue={handleSave}
                onBack={() => setStep("year")}
              />
              {saving && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
