import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Send, X, ChevronDown, User, Shield, ImagePlus, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TicketStatusBadge } from './TicketStatusBadge';
import { QuickReplyTemplates } from './QuickReplyTemplates';
import { useTicketDetail, type TicketMessage } from '@/hooks/useTicketDetail';
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_LABELS, type TicketStatus } from '@/hooks/useSupportTickets';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/formatLagos';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TicketDetailDrawerProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserClick?: (userId: string) => void;
}

const formatBubbleTime = (iso: string): string => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

const getDaySeparatorLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(a) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(b);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return fmtDate(d);
};

const MessageBubble = ({
  message,
  isOwn,
  onInternalNavigate,
}: {
  message: TicketMessage;
  isOwn: boolean;
  onInternalNavigate: (path: string) => void;
}) => {
  const time = formatBubbleTime(message.created_at);
  const isAi = message.sender_type === 'ai';
  const isAdmin = message.sender_type === 'admin';

  const senderLabel = isAi
    ? 'Viketa Helper'
    : isAdmin
      ? 'Support'
      : (message.sender?.full_name || 'You');

  const AvatarIcon = isAi ? Sparkles : isAdmin ? Shield : User;

  return (
    <div className={cn('flex gap-2 mb-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar className="h-7 w-7 shrink-0 mt-1">
        <AvatarImage src={!isAi ? (message.sender?.avatar_url || '') : ''} />
        <AvatarFallback
          className={cn(
            isOwn && 'bg-primary/20 text-primary',
            isAi && !isOwn && 'bg-gradient-to-br from-primary/30 to-primary/10 text-primary',
            !isOwn && !isAi && 'bg-muted',
          )}
        >
          <AvatarIcon className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>

      <div className={cn('max-w-[80%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {message.image_url && (
          <div className="mb-1.5">
            <a href={message.image_url} target="_blank" rel="noopener noreferrer">
              <img
                src={message.image_url}
                alt="Attached"
                className="max-w-[220px] max-h-[220px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity border border-border"
              />
            </a>
          </div>
        )}
        {message.message && (
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2 text-sm shadow-sm',
              isOwn && 'bg-primary text-primary-foreground rounded-br-md',
              !isOwn && isAi && 'bg-card border border-primary/30 text-foreground rounded-bl-md',
              !isOwn && !isAi && 'bg-muted text-foreground rounded-bl-md',
            )}
          >
            {isAi ? (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-p:leading-snug prose-ul:my-1.5 prose-strong:text-foreground">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => {
                      const isInternal = typeof href === 'string' && href.startsWith('/');
                      if (isInternal) {
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              onInternalNavigate(href!);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground no-underline hover:opacity-90"
                          >
                            {children}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        );
                      }
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          {children}
                        </a>
                      );
                    },
                    p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
                  }}
                >
                  {message.message}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words leading-snug">{message.message}</p>
            )}
          </div>
        )}
        <p
          className={cn(
            'text-[10px] text-muted-foreground mt-1 tabular-nums px-1 flex items-center gap-1',
            isOwn ? 'text-right justify-end' : 'text-left',
          )}
        >
          {isAi && <Sparkles className="h-2.5 w-2.5 text-primary" />}
          {senderLabel} · {time}
        </p>
      </div>
    </div>
  );
};

const DaySeparator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-border" />
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
      {label}
    </span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export const TicketDetailDrawer = ({ ticketId, open, onOpenChange, onUserClick }: TicketDetailDrawerProps) => {
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInternalNavigate = (path: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(path), 100);
  };
  
  
  const { 
    ticket, 
    messages, 
    isAdmin, 
    isLoading, 
    sendMessage, 
    isSending,
    updateStatus,
    isUpdating 
  } = useTicketDetail(ticketId);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('ticket-attachments')
        .getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
      return null;
    }
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedImage) || isSending || uploadingImage) return;
    let imageUrl: string | undefined;
    if (selectedImage) {
      setUploadingImage(true);
      const uploadedUrl = await uploadImage(selectedImage);
      setUploadingImage(false);
      if (!uploadedUrl && !newMessage.trim()) return;
      imageUrl = uploadedUrl || undefined;
    }
    sendMessage({ 
      message: newMessage.trim() || (imageUrl ? 'Sent an image' : ''),
      imageUrl 
    });
    setNewMessage('');
    removeSelectedImage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const statusOptions: TicketStatus[] = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
  const CategoryIcon = ticket ? CATEGORY_ICONS[ticket.category] : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92dvh] max-h-[92dvh] flex flex-col">
        <DrawerHeader className="border-b pb-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-base truncate pr-8">
                {isLoading ? <Skeleton className="h-5 w-48" /> : ticket?.subject}
              </DrawerTitle>
              {ticket && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {CategoryIcon && <CategoryIcon className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category]}</span>
                  <span className="text-muted-foreground">•</span>
                  {isAdmin ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center gap-1 focus:outline-none" disabled={isUpdating}>
                          <TicketStatusBadge status={ticket.status} className="text-[10px] py-0" />
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {statusOptions.map((status) => (
                          <DropdownMenuItem 
                            key={status}
                            onClick={() => updateStatus({ status })}
                            className={cn('text-xs', ticket.status === status && 'bg-accent')}
                          >
                            {STATUS_LABELS[status]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <TicketStatusBadge status={ticket.status} className="text-[10px] py-0" />
                  )}
                </div>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="shrink-0 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isAdmin && ticket?.user && (
            <div 
              className={cn(
                "mt-2 p-2 rounded-lg bg-muted/50 text-xs",
                onUserClick && "cursor-pointer hover:bg-muted transition-colors"
              )}
              onClick={() => ticket.user && onUserClick?.(ticket.user.id)}
            >
              <p className={cn("font-medium", onUserClick && "text-primary")}>
                {ticket.user.full_name}
              </p>
              <p className="text-muted-foreground mt-0.5 tabular-nums">
                Joined {fmtDate(ticket.user.created_at)}
                {ticket.user.is_banned && <span className="text-destructive ml-2">• Banned</span>}
              </p>
            </div>
          )}
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-background/50">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className={cn('flex gap-2', i % 2 === 0 ? 'flex-row-reverse' : '')}>
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-16 w-48 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const prev = messages[idx - 1];
              const currentDay = getDaySeparatorLabel(msg.created_at);
              const prevDay = prev ? getDaySeparatorLabel(prev.created_at) : null;
              const showSeparator = currentDay !== prevDay;
              return (
                <div key={msg.id}>
                  {showSeparator && <DaySeparator label={currentDay} />}
                  <MessageBubble
                    message={msg}
                    isOwn={isAdmin ? msg.sender_type === 'admin' : msg.sender_type === 'user'}
                    onInternalNavigate={handleInternalNavigate}
                  />
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-auto border-t bg-background pb-safe">
          {isAdmin && ticket?.status !== 'closed' && (
            <QuickReplyTemplates 
              userName={ticket?.user?.full_name}
              onSelectTemplate={(text) => setNewMessage(text)}
            />
          )}

          {ticket?.status !== 'closed' ? (
            <div className="p-3">
              {imagePreview && (
                <div className="mb-2 relative inline-block">
                  <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg border" />
                  <button
                    onClick={removeSelectedImage}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              
              <div className="flex gap-2 items-end">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || uploadingImage}
                  className="shrink-0 h-10 w-10 rounded-xl"
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
                
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="min-h-[40px] max-h-[120px] resize-none rounded-xl text-sm"
                  disabled={isSending || uploadingImage}
                />
                
                <Button 
                  onClick={handleSend} 
                  disabled={(!newMessage.trim() && !selectedImage) || isSending || uploadingImage}
                  size="icon"
                  className="shrink-0 h-10 w-10 rounded-xl"
                  haptic
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center bg-muted/30">
              <p className="text-xs text-muted-foreground font-medium">This help request is closed</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
