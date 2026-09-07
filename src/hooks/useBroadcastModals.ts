import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BroadcastModalData, IconTemplate } from '@/components/BroadcastModal';

interface RawModalNotification {
  id: string;
  title: string;
  message: string;
  icon_template: string;
  cta_button_text?: string;
  cta_button_link?: string;
  created_at: string;
}

export const useBroadcastModals = (userId: string | null) => {
  const [modalQueue, setModalQueue] = useState<BroadcastModalData[]>([]);
  const [currentModal, setCurrentModal] = useState<BroadcastModalData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch pending modal notifications
  const fetchPendingModals = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('notifications', {
        body: { action: 'get_pending_modals' },
      });

      if (error) {
        console.error('Error fetching pending modals:', error);
        return;
      }

      if (data?.success && data.modals?.length > 0) {
        const modals: BroadcastModalData[] = data.modals.map((m: RawModalNotification) => ({
          id: m.id,
          title: m.title,
          message: m.message,
          icon_template: (m.icon_template || 'megaphone') as IconTemplate,
          cta_button_text: m.cta_button_text,
          cta_button_link: m.cta_button_link,
        }));

        setModalQueue(modals);
        
        // Show the first modal
        if (modals.length > 0) {
          setCurrentModal(modals[0]);
          setIsOpen(true);
        }
      }
    } catch (err) {
      console.error('Error in fetchPendingModals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Dismiss a modal and mark it as seen
  const dismissModal = useCallback(async (notificationId: string) => {
    try {
      await supabase.functions.invoke('notifications', {
        body: { 
          action: 'dismiss_modal',
          notification_id: notificationId 
        },
      });
    } catch (err) {
      console.error('Error dismissing modal:', err);
    }
  }, []);

  // Handle closing the current modal
  const handleCloseModal = useCallback(async () => {
    if (!currentModal) return;

    // Dismiss the current modal
    await dismissModal(currentModal.id);

    // Remove from queue
    const newQueue = modalQueue.filter(m => m.id !== currentModal.id);
    setModalQueue(newQueue);

    // If there are more modals, show the next one after a short delay
    if (newQueue.length > 0) {
      setIsOpen(false);
      setTimeout(() => {
        setCurrentModal(newQueue[0]);
        setIsOpen(true);
      }, 500);
    } else {
      setIsOpen(false);
      setCurrentModal(null);
    }
  }, [currentModal, modalQueue, dismissModal]);

  // Add a new modal to the queue (for real-time notifications)
  const addModal = useCallback((modal: BroadcastModalData) => {
    setModalQueue(prev => {
      // Check if already in queue
      if (prev.some(m => m.id === modal.id)) {
        return prev;
      }
      return [...prev, modal];
    });

    // If no modal is currently showing, show this one
    if (!currentModal && !isOpen) {
      setCurrentModal(modal);
      setIsOpen(true);
    }
  }, [currentModal, isOpen]);

  // Fetch pending modals on mount
  useEffect(() => {
    if (userId) {
      fetchPendingModals();
    }
  }, [userId, fetchPendingModals]);

  return {
    currentModal,
    isOpen,
    isLoading,
    handleCloseModal,
    addModal,
    refreshModals: fetchPendingModals,
    pendingCount: modalQueue.length,
  };
};
