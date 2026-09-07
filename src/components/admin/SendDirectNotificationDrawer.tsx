import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, MessageSquare } from 'lucide-react';

interface SendDirectNotificationDrawerProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendDirectNotificationDrawer = ({
  userId,
  userName,
  open,
  onOpenChange,
}: SendDirectNotificationDrawerProps) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const canSend = title.trim() && message.trim();

  const handleSend = async () => {
    if (!canSend || !userId) return;

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-admin-notification', {
        body: {
          title: title.trim(),
          message: message.trim(),
          audience: 'manual',
          user_ids: [userId],
        },
      });

      if (error) throw error;

      toast.success('Message Sent!', {
        description: `Successfully sent to ${userName}`,
      });

      // Reset form and close
      setTitle('');
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send Message
          </DrawerTitle>
          <DrawerDescription>
            Send a direct notification to <strong>{userName}</strong>
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4 overflow-y-auto max-h-[60vh] pb-2">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="direct-title">Notification Title</Label>
            <Input
              id="direct-title"
              placeholder="e.g., Important Update"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">{title.length}/100 characters</p>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="direct-message">Message</Label>
            <Textarea
              id="direct-message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">{message.length}/500 characters</p>
          </div>

          {/* Preview */}
          {title && message && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-4 border rounded-lg bg-accent/20">
                <div className="flex gap-3">
                  <div className="text-2xl">📢</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{message}</p>
                    <p className="text-xs text-muted-foreground mt-2">Just now</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter>
          <Button
            onClick={handleSend}
            disabled={!canSend || isSending}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {isSending ? 'Sending...' : 'Send Message'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
