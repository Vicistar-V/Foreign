import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Loader2,
} from 'lucide-react';

export type ControlVariant = 'info' | 'warning' | 'danger';

export interface ControlActionConfig {
  title: string;
  description: string;
  variant?: ControlVariant;
  /** Optional impact bullets shown as a list so admin clearly sees the consequence. */
  impacts?: string[];
  /** Optional state preview chips at the top. */
  currentState?: { label: string; tone?: 'on' | 'off' | 'neutral' };
  nextState?: { label: string; tone?: 'on' | 'off' | 'neutral' };
  confirmLabel?: string;
  cancelLabel?: string;
  /** If provided, admin must type this phrase exactly to unlock the confirm button. */
  confirmPhrase?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ControlActionConfig | null;
  onConfirm: () => void;
  isLoading?: boolean;
}

const variantStyles: Record<ControlVariant, { icon: JSX.Element; tile: string; btn: string }> = {
  info: {
    icon: <Info className="h-5 w-5 text-info" />,
    tile: 'bg-info/10 border-info/20',
    btn: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-warning" />,
    tile: 'bg-warning/10 border-warning/30',
    btn: 'bg-warning hover:bg-warning/90 text-warning-foreground',
  },
  danger: {
    icon: <AlertCircle className="h-5 w-5 text-destructive" />,
    tile: 'bg-destructive/10 border-destructive/30',
    btn: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20',
  },
};

const StatePill = ({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'on' | 'off' | 'neutral';
}) => {
  const Icon = tone === 'on' ? CheckCircle2 : tone === 'off' ? CircleSlash : Info;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
        tone === 'on' && 'bg-success/15 text-success border-success/30',
        tone === 'off' && 'bg-muted text-muted-foreground border-border',
        tone === 'neutral' && 'bg-info/15 text-info border-info/30',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

export const AdminControlsActionDrawer = ({
  open,
  onOpenChange,
  config,
  onConfirm,
  isLoading = false,
}: Props) => {
  const [typedPhrase, setTypedPhrase] = useState('');

  useEffect(() => {
    if (!open) setTypedPhrase('');
  }, [open]);

  if (!config) return null;
  const variant = config.variant ?? 'info';
  const styles = variantStyles[variant];

  const phraseRequired = !!config.confirmPhrase;
  const phraseMatches = phraseRequired
    ? typedPhrase.trim().toUpperCase() === config.confirmPhrase!.toUpperCase()
    : true;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerHeader className="text-left pb-2">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0',
                styles.tile,
              )}
            >
              {styles.icon}
            </div>
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-lg leading-tight">{config.title}</DrawerTitle>
              <p className="text-sm text-muted-foreground mt-1 leading-snug">
                {config.description}
              </p>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto flex-1">
          {/* State preview */}
          {(config.currentState || config.nextState) && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-muted/40 border">
              {config.currentState && (
                <StatePill label={config.currentState.label} tone={config.currentState.tone} />
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              {config.nextState && (
                <StatePill label={config.nextState.label} tone={config.nextState.tone} />
              )}
            </div>
          )}

          {/* Impact list */}
          {config.impacts && config.impacts.length > 0 && (
            <div className={cn('rounded-2xl border p-4 space-y-2', styles.tile)}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">
                What will happen
              </p>
              <ul className="space-y-1.5">
                {config.impacts.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90 leading-snug">
                    <span className="text-foreground/40 mt-0.5">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Type-to-confirm */}
          {phraseRequired && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                To continue, type{' '}
                <span className="font-mono font-bold text-destructive">
                  {config.confirmPhrase}
                </span>{' '}
                below
              </Label>
              <Input
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                placeholder={config.confirmPhrase}
                className={cn(
                  'h-12 text-base font-mono tracking-wider uppercase',
                  phraseMatches && typedPhrase.length > 0 && 'border-success ring-1 ring-success/40',
                )}
                autoComplete="off"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="border-t p-4 flex flex-col-reverse sm:flex-row gap-2 bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-12 sm:flex-1 rounded-xl"
          >
            {config.cancelLabel || 'Cancel'}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !phraseMatches}
            className={cn(
              'h-12 sm:flex-1 rounded-xl font-bold active:scale-[0.98]',
              styles.btn,
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Working...
              </>
            ) : (
              config.confirmLabel || 'Confirm'
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
