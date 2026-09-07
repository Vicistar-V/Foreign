/**
 * Non-dismissible dialog that captures birth year + birth month for existing
 * users who signed up before we collected DOB. Two steps, mobile-first.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { YearOfBirthPicker } from "@/components/signup/YearOfBirthPicker";
import { MonthOfBirthPicker } from "@/components/signup/MonthOfBirthPicker";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  userId: string;
}

export const BirthDateRequiredDialog = ({ open, userId }: Props) => {
  const [step, setStep] = useState<"year" | "month">("year");
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

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
    // Keep saving=true so spinner stays until refetch closes the dialog.
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md p-0 gap-0 rounded-2xl border-border [&>button]:hidden max-h-[92vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="p-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base">Quick safety check</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            We need your birth year and month to keep your account safe. This
            takes 10 seconds.
          </DialogDescription>

          {/* Progress */}
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
