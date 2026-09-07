import { createContext, useContext, useEffect, ReactNode } from 'react';
import { BroadcastModal, BroadcastModalData, IconTemplate } from './BroadcastModal';
import { useBroadcastModals } from '@/hooks/useBroadcastModals';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface BroadcastModalContextType {
  addModal: (modal: BroadcastModalData) => void;
  pendingCount: number;
  refreshModals: () => void;
}

const BroadcastModalContext = createContext<BroadcastModalContextType | null>(null);

export const useBroadcastModalContext = () => {
  return useContext(BroadcastModalContext);
};

interface BroadcastModalProviderProps {
  children: ReactNode;
}

export const BroadcastModalProvider = ({ children }: BroadcastModalProviderProps) => {
  const { user } = useAuth();
  const {
    currentModal,
    isOpen,
    handleCloseModal,
    addModal,
    refreshModals,
    pendingCount,
  } = useBroadcastModals(user?.id || null);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to new notifications for this user on a private, user-scoped channel.
    const channel = supabase
      .channel(`user:${user.id}:broadcast-modals`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as any;
          const metadata = newNotification.metadata;

          // Check if this notification should be shown as a modal
          if (metadata?.show_as_modal === true && !metadata?.modal_dismissed_at) {
            const modalData: BroadcastModalData = {
              id: newNotification.id,
              title: newNotification.title,
              message: newNotification.message,
              icon_template: (metadata.icon_template || 'megaphone') as IconTemplate,
              cta_button_text: metadata.cta_button_text,
              cta_button_link: metadata.cta_button_link,
            };
            
            addModal(modalData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, addModal]);

  return (
    <BroadcastModalContext.Provider value={{ addModal, pendingCount, refreshModals }}>
      {children}
      <BroadcastModal
        isOpen={isOpen}
        onClose={handleCloseModal}
        data={currentModal}
      />
    </BroadcastModalContext.Provider>
  );
};
