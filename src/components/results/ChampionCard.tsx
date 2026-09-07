import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAvatar } from './UserAvatar';
import { Participant } from '@/types/participant';
import { Crown, Star, Trophy, MessageCircle, RefreshCw } from 'lucide-react';
import { ShareBraggingButton } from './ShareBraggingButton';
import { WinSharePromptDrawer } from './WinSharePromptDrawer';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { AvatarPreviewDrawer } from './AvatarPreviewDrawer';

interface ChampionCardProps {
  champion: Participant;
  rank?: number;
}

const getCycleConfig = (cycleNumber?: number) => {
  if (cycleNumber && cycleNumber >= 10) {
    return {
      icon: Crown,
      label: 'Veteran Earner',
      textColor: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
    };
  } else if (cycleNumber && cycleNumber >= 5) {
    return {
      icon: Star,
      label: 'Pro Earner',
      textColor: 'text-highlight',
      bgColor: 'bg-highlight/10',
      borderColor: 'border-highlight/30',
    };
  } else {
    return {
      icon: RefreshCw,
      label: 'Earner',
      textColor: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
    };
  }
};

export const ChampionCard = ({ champion, rank }: ChampionCardProps) => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSharePromptOpen, setIsSharePromptOpen] = useState(false);
  const config = getCycleConfig(champion.cycle_number);
  const Icon = config.icon;
  const isMyWin = user?.id === champion.user_id;

  const handleShareToGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSharePromptOpen(true);
  };

  return (
    <>
      <Card 
        className={`p-4 border ${config.borderColor} ${config.bgColor} cursor-pointer hover:bg-opacity-20 transition-colors`}
        onClick={() => setIsPreviewOpen(true)}
      >
        <div className="flex items-start gap-3">
          <UserAvatar 
            name={champion.full_name} 
            size="lg" 
            avatarUrl={champion.avatar_url}
          />
          
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="font-semibold text-base text-foreground truncate">
                {champion.full_name}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Icon className={`w-3.5 h-3.5 ${config.textColor}`} />
                <span className={`text-xs font-medium ${config.textColor}`}>
                  {config.label} #{champion.cycle_number || 1}
                </span>
                {rank && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    #{rank}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className={`text-2xl font-bold ${config.textColor} tabular-nums`}>
                ₦{champion.amount?.toLocaleString()}
              </p>
              {isMyWin ? (
                <div className="w-full sm:w-auto">
                  <Button
                    onClick={handleShareToGroup}
                    className="w-full sm:w-auto gap-2 bg-social-whatsapp hover:bg-social-whatsapp/90 text-white animate-pulse"
                    size="sm"
                    haptic="heavy"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Share to Group!
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <AvatarPreviewDrawer
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        name={champion.full_name}
        avatarUrl={champion.avatar_url}
        amount={champion.amount}
        role="winner"
      />

      {isMyWin && (
        <WinSharePromptDrawer
          isOpen={isSharePromptOpen}
          onClose={() => setIsSharePromptOpen(false)}
          amount={champion.amount || 0}
          referralCode={profile?.referral_code}
        />
      )}
    </>
  );
};
