/**
 * Non-dismissible dialog that captures state of residence for existing users
 * who signed up before we asked for it. Mirrors BirthDateRequiredDialog.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Loader2, MapPin, Search, Check } from "lucide-react";
import { NIGERIAN_STATES_ALPHA } from "@/lib/nigerianStates";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  userId: string;
}

export const StateRequiredDialog = ({ open, userId }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? NIGERIAN_STATES_ALPHA.filter(
        (s) => s.name.toLowerCase().includes(q) || s.zone.toLowerCase().includes(q),
      )
    : NIGERIAN_STATES_ALPHA;

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("save_my_state_of_residence", {
        _state: selected,
      });
      if (error) {
        toast({
          title: "Could not save",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
      // Optimistically update the cached profile so the dialog closes
      // immediately even if the refetch is slow.
      qc.setQueryData(["profile", userId], (old: any) =>
        old ? { ...old, state_of_residence: selected } : old,
      );
      await qc.invalidateQueries({ queryKey: ["profile", userId] });
    } finally {
      setSaving(false);
    }
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
            <MapPin className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base">The state you live in</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Pick the state where you are staying now (not where you were born). This helps us serve you better.
          </DialogDescription>
        </div>

        <div className="p-5 space-y-3">
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
              const isSelected = selected === s.name;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSelected(s.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-left transition-colors active:bg-primary/10",
                    isSelected ? "bg-primary/10" : "bg-card hover:bg-muted/50",
                  )}
                >
                  <div>
                    <p
                      className={cn(
                        "text-sm",
                        isSelected ? "font-bold text-primary" : "font-medium",
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

          <Button
            type="button"
            onClick={handleSave}
            disabled={!selected || saving}
            className="w-full h-12"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save & Continue"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
