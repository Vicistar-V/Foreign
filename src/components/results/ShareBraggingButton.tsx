import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { ShareOptionsDrawer } from './ShareOptionsDrawer';
import { useShareMessage } from '@/hooks/useShareMessage';

interface ShareBraggingButtonProps {
  amount?: number;
  isPersonalWin?: boolean;
}

export const ShareBraggingButton = ({ amount, isPersonalWin }: ShareBraggingButtonProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const shareMsg = useShareMessage();

  const resultsUrl = `${window.location.origin}/winners`;
  const message = shareMsg.headlineAndBody;

  const handleClick = () => {
    setIsDrawerOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-2"
      >
        <Share2 className="w-4 h-4" />
        Tell a friend
      </Button>

      <ShareOptionsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        message={message}
        url={resultsUrl}
        isPersonalWin={isPersonalWin}
      />
    </>
  );
};
