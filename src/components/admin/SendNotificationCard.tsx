import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserSearch } from '@/hooks/useUserSearch';
import { toast } from 'sonner';
import { Megaphone, Send, Users, UserCheck, UserX, Search, X, Lock, LockOpen, Gift, Trophy, Rocket, Heart, Star, Bell, Info, Eye, ArrowRight, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { parseSimpleMarkdown } from '@/lib/parseSimpleMarkdown';

type AudienceType = 'all' | 'members' | 'non_members' | 'manual';
type IconTemplate = 'megaphone' | 'gift' | 'trophy' | 'rocket' | 'heart' | 'star' | 'bell' | 'info';

const ICON_OPTIONS: { value: IconTemplate; label: string; icon: typeof Megaphone; color: string }[] = [
  { value: 'megaphone', label: 'Announcement', icon: Megaphone, color: 'text-info' },
  { value: 'gift', label: 'Bonus/Reward', icon: Gift, color: 'text-emerald-500' },
  { value: 'trophy', label: 'Win/Achievement', icon: Trophy, color: 'text-amber-500' },
  { value: 'rocket', label: 'New Feature', icon: Rocket, color: 'text-purple-500' },
  { value: 'heart', label: 'Thank You', icon: Heart, color: 'text-rose-500' },
  { value: 'star', label: 'Special', icon: Star, color: 'text-warning' },
  { value: 'bell', label: 'Reminder', icon: Bell, color: 'text-indigo-500' },
  { value: 'info', label: 'Information', icon: Info, color: 'text-cyan-500' },
];

const CTA_LINK_OPTIONS = [
  { value: '/dashboard', label: 'Dashboard' },
  
  { value: '/invite', label: 'Invite Friends' },
  { value: '/results', label: 'Results' },
  { value: '/transactions', label: 'Transactions' },
  { value: '/profile', label: 'Profile' },
  { value: '/support', label: 'Support' },
  { value: '/notifications', label: 'Notifications' },
];

export const SendNotificationCard = () => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<AudienceType>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Modal/popup options
  const [showAsModal, setShowAsModal] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<IconTemplate>('megaphone');
  const [ctaButtonText, setCtaButtonText] = useState('');
  const [ctaButtonLink, setCtaButtonLink] = useState('');

  const { data: searchResults } = useUserSearch(searchQuery);

  const handleAddUser = (user: { id: string; full_name: string; email: string }) => {
    if (!selectedUserIds.includes(user.id)) {
      setSelectedUserIds([...selectedUserIds, user.id]);
      setSelectedUsers([...selectedUsers, { id: user.id, name: user.full_name, email: user.email }]);
      setSearchQuery('');
    }
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const getAudienceCount = () => {
    if (audience === 'manual') return selectedUserIds.length;
    return '...'; // Will be calculated server-side
  };

  const canSend = title.trim() && message.trim() && (audience !== 'manual' || selectedUserIds.length > 0);

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-admin-notification', {
        body: {
          title: title.trim(),
          message: message.trim(),
          audience,
          user_ids: audience === 'manual' ? selectedUserIds : undefined,
          show_as_modal: showAsModal,
          icon_template: showAsModal ? selectedIcon : undefined,
          cta_button_text: showAsModal && ctaButtonText.trim() ? ctaButtonText.trim() : undefined,
          cta_button_link: showAsModal && ctaButtonLink ? ctaButtonLink : undefined,
        },
      });

      if (error) throw error;

      toast.success('Notification Sent!', {
        description: `Successfully sent to ${data.sent_count} users${showAsModal ? ' (with popup)' : ''}`,
      });

      // Reset form
      setTitle('');
      setMessage('');
      setAudience('all');
      setSelectedUserIds([]);
      setSelectedUsers([]);
      setShowAsModal(false);
      setSelectedIcon('megaphone');
      setCtaButtonText('');
      setCtaButtonLink('');
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedIconConfig = ICON_OPTIONS.find(o => o.value === selectedIcon);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Write a New Message</CardTitle>
              <CardDescription>Tell your members about updates, rewards, or announcements.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Edit Mode Toggle */}
          <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${isEditMode ? 'border-primary bg-primary/5' : 'border-muted bg-muted/50'}`}>
            <div className="flex items-center gap-3">
              {isEditMode ? (
                <LockOpen className="h-5 w-5 text-primary" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">Writing Mode</p>
                <p className="text-xs text-muted-foreground">
                  {isEditMode ? 'Ready to write your message' : 'Turn on to write a message'}
                </p>
              </div>
            </div>
            <Switch
              checked={isEditMode}
              onCheckedChange={setIsEditMode}
            />
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Headline</Label>
            <Input enterKeyHint="next" autoComplete="off"
              id="title"
              placeholder="e.g., Platform Update"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              disabled={!isEditMode}
            />
            <p className="text-xs text-muted-foreground">{title.length}/100 characters</p>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">What do you want to say?</Label>
            <Textarea enterKeyHint="done"
              id="message"
              placeholder="Type your announcement here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={800}
              className="resize-none"
              disabled={!isEditMode}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>You can use **bold text** with stars • Press Enter for new lines</span>
              <span>{message.length}/800</span>
            </div>
          </div>

          {/* Show as Popup Toggle */}
          <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${showAsModal ? 'border-primary bg-primary/5' : 'border-muted bg-muted/50'}`}>
            <div className="flex items-center gap-3">
              <Eye className={cn("h-5 w-5", showAsModal ? "text-primary" : "text-muted-foreground")} />
              <div>
                <p className="font-medium text-sm">Show as a Window (Pop-up)</p>
                <p className="text-xs text-muted-foreground">
                  {showAsModal ? 'Users will see a big window with your message as soon as they open the app.' : 'Shows only in notification list'}
                </p>
              </div>
            </div>
            <Switch
              checked={showAsModal}
              onCheckedChange={setShowAsModal}
              disabled={!isEditMode}
            />
          </div>

          {/* Modal Options (only shown when showAsModal is true) */}
          {showAsModal && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Popup Settings
              </h4>
              
              {/* Icon Selector */}
              <div className="space-y-2">
                <Label>Pick a Picture</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ICON_OPTIONS.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedIcon(option.value)}
                        disabled={!isEditMode}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                          selectedIcon === option.value
                            ? "border-primary bg-primary/10"
                            : "border-muted hover:border-primary/50",
                          !isEditMode && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <IconComponent className={cn("h-6 w-6", option.color)} />
                        <span className="text-xs text-muted-foreground truncate w-full text-center">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA Button Settings */}
              <div className="space-y-3">
                <Label>Add a Button (Optional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Input
                      placeholder="Button text (e.g., Start Inviting)"
                      value={ctaButtonText}
                      onChange={(e) => setCtaButtonText(e.target.value)}
                      maxLength={30}
                      disabled={!isEditMode}
                    />
                    <p className="text-xs text-muted-foreground">{ctaButtonText.length}/30 characters</p>
                  </div>
                  <Select
                    value={ctaButtonLink}
                    onValueChange={setCtaButtonLink}
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Where should the button take them?" />
                    </SelectTrigger>
                    <SelectContent>
                      {CTA_LINK_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  If both filled, a button will appear that takes users to the selected page
                </p>
              </div>
            </div>
          )}

          {/* Audience Selector */}
          <div className="space-y-3">
            <Label>Who should receive this?</Label>
            <RadioGroup value={audience} onValueChange={(value) => setAudience(value as AudienceType)} disabled={!isEditMode}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Users className="h-4 w-4" />
                  <span>All Users (Active accounts only)</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                <RadioGroupItem value="members" id="members" />
                <Label htmlFor="members" className="flex items-center gap-2 cursor-pointer flex-1">
                  <UserCheck className="h-4 w-4" />
                  <span>Activated Members Only</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                <RadioGroupItem value="non_members" id="non_members" />
                <Label htmlFor="non_members" className="flex items-center gap-2 cursor-pointer flex-1">
                  <UserX className="h-4 w-4" />
                  <span>Non-Activated Users Only</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Search className="h-4 w-4" />
                  <span>Pick Specific People</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Manual User Selection */}
          {audience === 'manual' && (
            <div className="space-y-3">
              <Label>Selected Users ({selectedUserIds.length})</Label>
              
              {/* User Search Input */}
              <div className="space-y-2">
                <Input type="search" enterKeyHint="search"
                  placeholder="Search by name, email, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  disabled={!isEditMode}
                />
                
                {/* Search Results */}
                {searchQuery && searchResults?.users && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.users.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                    ) : (
                      <div className="divide-y">
                        {searchResults.users.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleAddUser(user)}
                            disabled={selectedUserIds.includes(user.id)}
                            className="w-full p-3 text-left hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{user.full_name}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                              <span className="text-xs text-muted-foreground">Code: {user.referral_code}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Users Display */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="gap-1">
                      <span>{user.name}</span>
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-1.5"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {selectedUserIds.length === 0 && (
                <Alert>
                  <AlertDescription>
                    No users selected. Use the search above to add recipients.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Preview */}
          <div className="space-y-3">
            <Label>Message Preview</Label>
            {(!title && !message) ? (
              <div className="p-8 border-2 border-dashed rounded-lg bg-muted/20 text-center">
                <p className="text-sm text-muted-foreground italic">Your message preview will appear here as you type...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {showAsModal ? "What it looks like as a window:" : "What it looks like in the list:"}
                </p>
                
                {showAsModal ? (
                  /* Modal Preview */
                  <div className="p-6 border-2 border-dashed rounded-lg bg-background">
                    <div className="flex flex-col items-center text-center">
                      {/* Icon */}
                      {selectedIconConfig && (
                        <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-4", 
                          selectedIcon === 'megaphone' && "bg-info/20",
                          selectedIcon === 'gift' && "bg-emerald-500/20",
                          selectedIcon === 'trophy' && "bg-amber-500/20",
                          selectedIcon === 'rocket' && "bg-purple-500/20",
                          selectedIcon === 'heart' && "bg-rose-500/20",
                          selectedIcon === 'star' && "bg-warning/20",
                          selectedIcon === 'bell' && "bg-indigo-500/20",
                          selectedIcon === 'info' && "bg-cyan-500/20",
                        )}>
                          <selectedIconConfig.icon className={cn("h-8 w-8", selectedIconConfig.color)} />
                        </div>
                      )}
                      
                      {/* Title */}
                      <h3 className="font-bold text-lg mb-2">{title}</h3>
                      
                      {/* Message */}
                      <div 
                        className="text-muted-foreground text-sm mb-4 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:my-2 [&_li]:py-0.5"
                        dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(message) }}
                      />
                      
                      {/* CTA Button Preview */}
                      {ctaButtonText && ctaButtonLink && (
                        <div className="w-full max-w-xs mb-2">
                          <Button className="w-full" disabled>
                            {ctaButtonText}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      <span className="text-xs text-muted-foreground">Got it, thanks</span>
                    </div>
                  </div>
                ) : (
                  /* Regular Notification Preview */
                  <div className="p-4 border rounded-lg bg-accent/20">
                    <div className="flex gap-3">
                      <div className="text-2xl">📢</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{title || 'Headline'}</p>
                        <p className="text-sm text-muted-foreground mt-1">{message || 'Your message will appear here...'}</p>
                        <p className="text-xs text-muted-foreground mt-2">Just now</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!isEditMode || !canSend || isSending}
            className="w-full"
            size="lg"
          >
            <Send className="mr-2 h-4 w-4" />
            Send to {getAudienceCount()} {audience === 'manual' && selectedUserIds.length === 1 ? 'user' : 'users'}
            {showAsModal && ' (with popup)'}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you ready to send this message?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>You are about to send:</p>
                <div className="p-3 bg-accent/50 rounded-lg space-y-2">
                  <p><strong>Title:</strong> {title}</p>
                  <p><strong>Message:</strong> {message}</p>
                  <p>
                    <strong>To:</strong>{' '}
                    {audience === 'all' && 'All active users'}
                    {audience === 'members' && 'All activated members'}
                    {audience === 'non_members' && 'All non-activated users'}
                    {audience === 'manual' && `${selectedUserIds.length} selected user${selectedUserIds.length === 1 ? '' : 's'}`}
                  </p>
                  {showAsModal && (
                    <p><strong>Display:</strong> As popup with {selectedIcon} icon</p>
                  )}
                  {showAsModal && ctaButtonText && ctaButtonLink && (
                    <p><strong>Button:</strong> "{ctaButtonText}" → {ctaButtonLink}</p>
                  )}
                </div>
                <p className="text-sm">
                  {showAsModal 
                    ? 'Users will see this as a popup immediately when they open the app!' 
                    : 'This notification will appear in users\' notification list.'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isSending}>
              {isSending ? 'Sending...' : 'Yes, Send it Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
