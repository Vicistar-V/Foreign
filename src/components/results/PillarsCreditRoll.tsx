import { useState, useEffect } from 'react';
import { Heart, Users } from 'lucide-react';
import { Participant } from '@/types/participant';
import { UserAvatar } from './UserAvatar';
import { StaggeredList, StaggeredItem } from '@/components/animations';
import { AvatarPreviewDrawer } from './AvatarPreviewDrawer';
import { SimplePagination } from '@/components/ui/SimplePagination';

interface PillarsCreditRollProps {
  contributors: Participant[];
}

const ITEMS_PER_PAGE = 10;

export const PillarsCreditRoll = ({ contributors }: PillarsCreditRollProps) => {
  const [selectedContributor, setSelectedContributor] = useState<Participant | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contributors]);

  if (contributors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  const totalItems = contributors.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const visibleContributors = contributors.slice(startIndex, endIndex);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-community pb-3 border-b border-border">
          <Users className="w-4 h-4" />
          <p className="text-sm font-medium">
            Recent members activating ad shares
          </p>
        </div>

        <StaggeredList className="space-y-2">
          {visibleContributors.map((contributor, index) => (
            <StaggeredItem key={startIndex + index}>
              <div 
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedContributor(contributor)}
              >
                <UserAvatar 
                  name={contributor.full_name} 
                  size="sm" 
                  avatarUrl={contributor.avatar_url}
                />
                <span className="text-sm font-medium text-foreground truncate">
                  {contributor.full_name}
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
        isOpen={!!selectedContributor}
        onClose={() => setSelectedContributor(null)}
        name={selectedContributor?.full_name || ''}
        avatarUrl={selectedContributor?.avatar_url}
        role="contributor"
      />
    </>
  );
};
