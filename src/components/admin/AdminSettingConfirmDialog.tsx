import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'warning' | 'danger' | 'info';
}

interface AdminSettingConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ConfirmDialogConfig | null;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const AdminSettingConfirmDialog = ({
  open,
  onOpenChange,
  config,
  onConfirm,
  isLoading = false,
}: AdminSettingConfirmDialogProps) => {
  if (!config) return null;

  const getIcon = () => {
    switch (config.variant) {
      case 'danger':
        return <AlertCircle className="h-6 w-6 text-destructive animate-pulse" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-warning" />;
      case 'info':
      default:
        return <Info className="h-6 w-6 text-info" />;
    }
  };

  const getActionClass = () => {
    switch (config.variant) {
      case 'danger':
        return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg shadow-destructive/20';
      case 'warning':
        return 'bg-warning hover:bg-warning/90 text-warning-foreground font-bold';
      case 'info':
      default:
        return 'bg-primary hover:bg-primary/90 text-primary-foreground font-medium';
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-2">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              config.variant === 'danger' && "bg-destructive/10",
              config.variant === 'warning' && "bg-warning/10",
              config.variant === 'info' && "bg-info/10",
            )}>
              {getIcon()}
            </div>
            <AlertDialogTitle className="text-xl leading-tight">
              {config.title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
            {config.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-3 mt-4">
          <AlertDialogCancel 
            disabled={isLoading}
            className="rounded-xl h-12 sm:h-10 transition-all hover:bg-accent border-muted-foreground/20"
          >
            {config.cancelLabel || 'No, Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className={cn(
              "rounded-xl h-12 sm:h-10 transition-all active:scale-95",
              getActionClass()
            )}
          >
            {isLoading ? 'Processing...' : (config.confirmLabel || 'Yes, Continue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
