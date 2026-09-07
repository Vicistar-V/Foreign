import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';

type FromPage = 'withdrawals' | 'deposits' | 'support' | 'referrals' | 'dashboard' | 'reviews';

interface ClickableUserProps {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  fromPage: FromPage;
  showAvatar?: boolean;
  avatarSize?: 'sm' | 'md' | 'lg';
  nameClassName?: string;
}

const avatarSizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/**
 * Reusable component for displaying a user with:
 * - Clickable avatar that opens preview drawer
 * - Clickable name that navigates to user profile
 */
export const ClickableUser = ({
  userId,
  userName,
  avatarUrl,
  fromPage,
  showAvatar = true,
  avatarSize = 'md',
  nameClassName = 'font-semibold',
}: ClickableUserProps) => {
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);

  const goToProfile = () => {
    navigate(`/admin/users/${userId}?from=${fromPage}`);
  };

  const openAvatarPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {showAvatar && (
          <Avatar 
            className={`${avatarSizeClasses[avatarSize]} cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all`}
            onClick={openAvatarPreview}
          >
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
        <button
          onClick={goToProfile}
          className={`${nameClassName} hover:text-primary hover:underline transition-colors text-left truncate`}
        >
          {userName}
        </button>
      </div>

      <AvatarPreviewDrawer
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        name={userName}
        avatarUrl={avatarUrl}
      />
    </>
  );
};

// Simpler hook for pages that need to manage preview state themselves
export const useAvatarPreview = () => {
  const [previewUser, setPreviewUser] = useState<{
    name: string;
    avatarUrl: string | null;
  } | null>(null);

  return {
    previewUser,
    openPreview: (name: string, avatarUrl: string | null) => setPreviewUser({ name, avatarUrl }),
    closePreview: () => setPreviewUser(null),
    isOpen: !!previewUser,
  };
};
