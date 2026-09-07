import { useState, useEffect } from 'react';
import { Participant } from '@/types/participant';
import { ChampionCard } from './ChampionCard';
import { StaggeredList, StaggeredItem } from '@/components/animations';
import { SimplePagination } from '@/components/ui/SimplePagination';

interface ChampionsPodiumProps {
  winners: Participant[];
}

const ITEMS_PER_PAGE = 10;

export const ChampionsPodium = ({ winners }: ChampionsPodiumProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when winners change
  useEffect(() => {
    setCurrentPage(1);
  }, [winners]);

  if (winners.length === 0) return null;

  const totalItems = winners.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const visibleWinners = winners.slice(startIndex, endIndex);

  return (
    <div className="space-y-3">
      <StaggeredList className="space-y-3">
        {visibleWinners.map((winner, index) => (
          <StaggeredItem key={startIndex + index}>
            <ChampionCard champion={winner} rank={startIndex + index + 1} />
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
  );
};
