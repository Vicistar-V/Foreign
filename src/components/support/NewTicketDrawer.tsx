import { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CATEGORY_LABELS, type TicketCategory } from '@/hooks/useSupportTickets';
import { cn } from '@/lib/utils';
import {
  ImagePlus,
  X,
  Loader2,
  ArrowLeft,
  ChevronRight,
  Wallet,
  UserCircle2,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NewTicketDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    subject: string;
    category: TicketCategory;
    message: string;
    imageUrl?: string;
  }) => void;
  isLoading?: boolean;
}

const categories: TicketCategory[] = [
  'money_issue',
  'account_problem',
  'how_to_use',
  'complaint',
  'suggestion',
  'other',
];

// Local Lucide icon map (no emojis, per design system)
const CATEGORY_LUCIDE: Record<TicketCategory, LucideIcon> = {
  money_issue: Wallet,
  account_problem: UserCircle2,
  how_to_use: HelpCircle,
  complaint: AlertTriangle,
  suggestion: MessageSquare,
  other: MoreHorizontal,
};

const CATEGORY_HINT: Record<TicketCategory, string> = {
  money_issue: 'Deposits, withdrawals, missing money',
  account_problem: 'Login, PIN, profile, banned account',
  how_to_use: 'How something works on the platform',
  complaint: 'Something went wrong, you want to report',
  suggestion: 'Ideas to make Viketa better',
  other: 'Anything else not on this list',
};

type Step = 1 | 2;

export const NewTicketDrawer = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: NewTicketDrawerProps) => {
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset everything when the drawer closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setCategory(null);
      setSubject('');
      setMessage('');
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('ticket-attachments').getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
      return null;
    }
  };

  const pickCategory = (cat: TicketCategory) => {
    setCategory(cat);
    // Auto-advance for a one-tap flow on mobile
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!category || !subject.trim() || !message.trim()) return;

    let imageUrl: string | undefined;
    if (selectedImage) {
      setUploadingImage(true);
      const uploadedUrl = await uploadImage(selectedImage);
      setUploadingImage(false);
      if (uploadedUrl) imageUrl = uploadedUrl;
    }

    onSubmit({
      subject: subject.trim(),
      category,
      message: message.trim(),
      imageUrl,
    });
  };

  const isValid =
    !!category && subject.trim().length > 0 && message.trim().length > 0;
  const isSubmitting = isLoading || uploadingImage;
  const SelectedIcon = category ? CATEGORY_LUCIDE[category] : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={() => setStep(1)}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DrawerTitle className="text-xl">
              {step === 1 ? 'What do you need help with?' : 'Tell us what happened'}
            </DrawerTitle>
          </div>

          {/* Tiny step indicator */}
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                step >= 1 ? 'bg-primary' : 'bg-muted',
              )}
            />
            <div
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                step >= 2 ? 'bg-primary' : 'bg-muted',
              )}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Step {step} of 2
          </p>
        </DrawerHeader>

        <div className="px-4 pb-4 overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-2">
              {categories.map((cat) => {
                const Icon = CATEGORY_LUCIDE[cat];
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => pickCategory(cat)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all active:scale-[0.99]',
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/40',
                    )}
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        selected ? 'bg-primary/20' : 'bg-muted',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5',
                          selected ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {CATEGORY_LABELS[cat]}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {CATEGORY_HINT[cat]}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected category chip */}
              {category && SelectedIcon && (
                <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 w-fit">
                  <SelectedIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[12px] font-medium text-foreground">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[11px] text-primary font-medium underline-offset-2 hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Briefly describe your issue
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., I can't withdraw my money"
                  maxLength={100}
                  autoFocus
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Tell us more about what happened
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your issue in detail so we can help you better..."
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">
                  {message.length}/2000
                </p>
              </div>

              {/* Image */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Add a screenshot (optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Selected"
                      className="h-24 w-24 object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={removeSelectedImage}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Add Image
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {step === 2 && (
          <DrawerFooter>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="w-full"
              size="lg"
              haptic
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadingImage ? 'Uploading...' : 'Sending...'}
                </>
              ) : (
                'Send Help Request'
              )}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
};
