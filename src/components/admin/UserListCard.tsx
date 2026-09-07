import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { UserCheck, Ban, Users, TrendingUp, Calendar, Trophy, Clock, MapPin, Hash, UserPlus2, Phone, Cake, Boxes, Wallet, Hourglass } from 'lucide-react';
import type { UserListItem } from '@/hooks/useAllUsers';
import { getActivityStatus, formatLastSeen } from '@/hooks/useAllUsers';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { fmtDate } from '@/lib/formatLagos';
import { openWhatsAppChat } from '@/lib/whatsappUtils';
import { estimateAge } from '@/lib/ageUtils';

interface UserListCardProps {
  user: UserListItem;
  onSelect: (userId: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (userId: string) => void;
}

export const UserListCard = ({
  user,
  onSelect,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: UserListCardProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const navigate = useNavigate();
  
  const activityStatus = getActivityStatus(user.last_activity_at);
  const lastSeenText = formatLastSeen(user.last_activity_at);
  
  const activityColors = {
    active: 'bg-success',
    idle: 'bg-warning',
    dormant: 'bg-destructive',
    never: 'bg-muted-foreground/50',
  };

  const activityTooltips = {
    active: 'Online now (last 5 min)',
    idle: 'Recently active (5–60 min)',
    dormant: 'Offline (60+ min)',
    never: 'Never opened the app',
  };

  const getLocationText = () => {
    if (!user.current_location) return null;
    return activityStatus === 'active' 
      ? `On ${user.current_location.page_name}` 
      : `Last on ${user.current_location.page_name}`;
  };

  const locationText = getLocationText();

  return (
    <Card
      className={`cursor-pointer transition-all active:scale-[0.99] ${
        selectMode && selected
          ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
          : 'hover:border-primary/50'
      }`}
      onClick={() => (selectMode ? onToggleSelect?.(user.id) : onSelect(user.id))}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {selectMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.(user.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-3 h-5 w-5 shrink-0"
              aria-label={`Pick ${user.full_name}`}
            />
          )}
          {/* Avatar with Activity Indicator */}
          <div className="relative">
            <Avatar 
              className="h-12 w-12 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (selectMode) {
                  onToggleSelect?.(user.id);
                  return;
                }
                setPreviewOpen(true);
              }}
            >

              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold leading-none">
                {user.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span 
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background ${activityColors[activityStatus]} ${activityStatus === 'active' ? 'animate-pulse' : ''}`}
              title={activityTooltips[activityStatus]}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-base truncate">{user.full_name}</h3>
              
              {/* Core Status Badges */}
              {user.is_banned ? (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  <Ban className="w-2.5 h-2.5 mr-1" />
                  Locked
                </Badge>
              ) : user.is_member ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] px-1.5 py-0 h-4">
                  <UserCheck className="w-2.5 h-2.5 mr-1" />
                  Joined
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] px-1.5 py-0 h-4">
                  Not joined
                </Badge>
              )}
            </div>

            {/* Email & inviter */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">{user.email}</p>
              {user.referred_by_code ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (user.referrer_id) navigate(`/admin/users/${user.referrer_id}?from=referrals`);
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-1.5 rounded truncate max-w-[160px] transition-colors"
                  title={`Open inviter: ${user.referrer_name || user.referred_by_code}`}
                  disabled={!user.referrer_id}
                >
                  <UserPlus2 className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{user.referrer_name || user.referred_by_code}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 bg-muted/30 px-1 rounded">
                  <UserPlus2 className="h-2.5 w-2.5" />
                  Direct
                </span>
              )}
            </div>
            
            {/* Stats Row */}
            <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fmtDate(user.created_at)}
              </span>
              <span className="flex items-center gap-1 text-success font-medium tabular-nums">
                <TrendingUp className="h-3 w-3" />
                ₦{(user.balances?.earnings_balance ?? 0).toLocaleString()}
              </span>
              {(user.balances?.pending_balance ?? 0) > 0 && (
                <span
                  className="flex items-center gap-1 text-warning font-semibold tabular-nums"
                  title="Money still waiting (pending balance)"
                >
                  <Hourglass className="h-3 w-3" />
                  ₦{(user.balances?.pending_balance ?? 0).toLocaleString()}
                </span>
              )}
              {(user.balances?.deposit_balance ?? 0) > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Wallet className="h-3 w-3" />
                  ₦{(user.balances?.deposit_balance ?? 0).toLocaleString()}
                </span>
              )}
              <span className="flex items-center gap-1 tabular-nums">
                <Users className="h-3 w-3" />
                {user.referral_count.toLocaleString()}
              </span>
              {(user.active_spots ?? 0) > 0 && (
                <span className="flex items-center gap-1 tabular-nums text-primary font-medium">
                  <Boxes className="h-3 w-3" />
                  {user.active_spots}
                </span>
              )}
            </div>

            {/* Phone + Birth + Last seen + Location row */}
            <div className="flex items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {lastSeenText}
              </span>
              {user.phone_number && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsAppChat(user.phone_number!);
                  }}
                  className="flex items-center gap-1 tabular-nums truncate max-w-[140px] text-success hover:underline"
                  title="Open WhatsApp chat"
                >
                  <Phone className="h-3 w-3" />
                  {user.phone_number}
                </button>
              )}
              {(() => {
                const age = estimateAge(user.birth_year, user.birth_month);
                return age !== null ? (
                  <span className="flex items-center gap-1 tabular-nums">
                    <Cake className="h-3 w-3" />
                    {age} yrs
                  </span>
                ) : null;
              })()}
              {locationText && (
                <span className={`flex items-center gap-1 truncate max-w-[200px] ${activityStatus === 'active' ? 'text-success font-medium' : ''}`}>
                  <MapPin className="h-3 w-3" />
                  {locationText}
                </span>
              )}
            </div>
          </div>

          {/* Right side - Desktop Only Secondary Info */}
          <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
            {(user.total_drops_joined ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {user.total_drops_joined.toLocaleString()} drops
              </span>
            )}
            {!user.email_confirmed && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] px-1.5 py-0 h-4">
                Email pending
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      
      <AvatarPreviewDrawer
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        name={user.full_name}
        avatarUrl={user.avatar_url}
      />
    </Card>
  );
};
