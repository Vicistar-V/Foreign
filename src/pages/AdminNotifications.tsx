import { SendNotificationCard } from '@/components/admin/SendNotificationCard';
import { PastBroadcastsList } from '@/components/admin/PastBroadcastsList';
import { Megaphone } from 'lucide-react';

export default function AdminNotifications() {
  return (
    <div className="p-3 md:p-8 max-w-4xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-8">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 md:h-6 md:w-6 text-primary" />
        <h1 className="text-xl md:text-3xl font-bold">Send a Message to Members</h1>
      </div>

      <SendNotificationCard />
      <PastBroadcastsList />
    </div>
  );
}
