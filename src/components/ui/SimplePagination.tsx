import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (value: number) => void;
  showItemsPerPageSelector?: boolean;
  className?: string;
}

export const SimplePagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPageSelector = !!onItemsPerPageChange,
  className,
}: SimplePaginationProps) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Dashboard pages live inside a scrollable <main>; reset that too
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      scrollToTop();
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      scrollToTop();
    }
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3 py-4", className)}>
      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="default"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="h-11 px-4 flex items-center gap-2 flex-1 sm:flex-initial"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </Button>

        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <Button
          variant="outline"
          size="default"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="h-11 px-4 flex items-center gap-2 flex-1 sm:flex-initial"
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Items Per Page Selector and Item Count */}
      <div className="flex items-center justify-between gap-3 px-1">
        {showItemsPerPageSelector && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Show:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
            >
              <SelectTrigger className="h-9 w-[70px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-xs text-muted-foreground ml-auto">
          Showing {startItem}-{endItem} of {totalItems} items
        </p>
      </div>
    </div>
  );
};
