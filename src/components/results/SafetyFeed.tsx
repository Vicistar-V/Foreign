import { useState, useEffect } from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { Participant } from '@/types/participant';
import { UserAvatar } from './UserAvatar';
import { StaggeredList, StaggeredItem } from '@/components/animations';
import { AvatarPreviewDrawer } from './AvatarPreviewDrawer';
import { SimplePagination } from '@/components/ui/SimplePagination';

interface SafetyFeedProps {
  protectedUsers: Participant[];
}

const ITEMS_PER_PAGE = 10;

export const SafetyFeed = ({ protectedUsers }: SafetyFeedProps) => {
  const [selectedUser, setSelectedUser] = useState<Participant | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [protectedUsers]);

  if (protectedUsers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No active campaigns</p>
      </div>
    );
  }

  const totalItems = protectedUsers.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const visibleUsers = protectedUsers.slice(startIndex, endIndex);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-highlight pb-3 border-b border-border">
          <RefreshCw className="w-4 h-4" />
          <p className="text-sm font-medium">
            {protectedUsers.length} people with a campaign running
          </p>
        </div>

        <StaggeredList className="space-y-2">
          {visibleUsers.map((user, index) => (
            <StaggeredItem key={startIndex + index}>
              <div 
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedUser(user)}
              >
                <UserAvatar 
                  name={user.full_name} 
                  size="sm" 
                  avatarUrl={user.avatar_url}
                />
                <span className="text-sm font-medium text-foreground truncate">
                  {user.full_name}
                </span>
              </div>
            </StaggeredItem>
          ))}
        </StaggeredList>

        {totalPages > 1 && (
          <SimplePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <AvatarPreviewDrawer
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        name={selectedUser?.full_name || ''}
        avatarUrl={selectedUser?.avatar_url}
        role="protected"
      />
    </>
  );
};
