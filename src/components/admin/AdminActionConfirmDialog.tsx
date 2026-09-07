import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Shield } from 'lucide-react';

interface AdminActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  variant?: 'default' | 'destructive' | 'warning';
  onConfirm: (pin: string) => void;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const AdminActionConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  variant = 'default',
  onConfirm,
  isLoading = false,
  children,
}: AdminActionConfirmDialogProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    setError('');
    onConfirm(pin);
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onOpenChange(false);
  };

  const variantStyles = {
    default: {
      icon: <Shield className="h-6 w-6 text-primary" />,
      buttonClass: '',
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-warning" />,
      buttonClass: 'bg-warning hover:bg-warning text-white',
    },
    destructive: {
      icon: <AlertTriangle className="h-6 w-6 text-destructive" />,
      buttonClass: '',
    },
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {variantStyles[variant].icon}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Extra content (e.g., preview of changes) */}
        {children && (
          <div className="py-2">
            {children}
          </div>
        )}

        {/* PIN Input */}
        <div className="space-y-2 py-2">
          <Label htmlFor="admin-pin" className="text-sm font-medium">
            Enter your admin PIN to confirm
          </Label>
          <Input
            id="admin-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="● ● ● ●"
            value={pin}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setPin(value);
              if (error) setError('');
            }}
            className="text-center text-xl tracking-[0.5em] font-mono"
            disabled={isLoading}
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            className={variantStyles[variant].buttonClass}
            onClick={handleConfirm}
            disabled={isLoading || pin.length !== 4}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
