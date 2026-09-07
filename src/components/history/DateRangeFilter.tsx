/**
 * Premium Date Range Filter - Pill-style buttons with better UX
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { formatNigerianDate } from '@/lib/nigerianTime';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type DateRangeType = 'all' | 'last7days' | 'last30days' | 'custom';

interface DateRangeFilterProps {
  dateRange: DateRangeType;
  customStartDate: Date | undefined;
  customEndDate: Date | undefined;
  onDateRangeChange: (range: DateRangeType) => void;
  onCustomRangeChange: (start: Date | undefined, end: Date | undefined) => void;
}

export const DateRangeFilter = ({
  dateRange,
  customStartDate,
  customEndDate,
  onDateRangeChange,
  onCustomRangeChange,
}: DateRangeFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(customStartDate);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(customEndDate);
  const isMobile = useIsMobile();

  const presets = [
    { value: 'all' as const, label: 'All' },
    { value: 'last7days' as const, label: '7 Days' },
    { value: 'last30days' as const, label: '30 Days' },
  ];

  const handleApplyCustomRange = () => {
    if (tempStartDate && tempEndDate) {
      onCustomRangeChange(tempStartDate, tempEndDate);
      onDateRangeChange('custom');
      setIsOpen(false);
    }
  };

  const handleClearCustomRange = () => {
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    onCustomRangeChange(undefined, undefined);
    onDateRangeChange('all');
  };

  const CustomRangePicker = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-2 text-muted-foreground">Start Date</p>
          <Calendar
            mode="single"
            selected={tempStartDate}
            onSelect={setTempStartDate}
            disabled={(date) => date > new Date()}
            className={cn("rounded-xl border bg-card pointer-events-auto")}
          />
        </div>
        
        <div>
          <p className="text-sm font-medium mb-2 text-muted-foreground">End Date</p>
          <Calendar
            mode="single"
            selected={tempEndDate}
            onSelect={setTempEndDate}
            disabled={(date) => 
              date > new Date() || (tempStartDate ? date < tempStartDate : false)
            }
            className={cn("rounded-xl border bg-card pointer-events-auto")}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Quick Presets - Pill style */}
      <div className="flex gap-2 flex-wrap">
        {presets.map((preset) => (
          <motion.button
            key={preset.value}
            onClick={() => onDateRangeChange(preset.value)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium transition-all duration-200",
              dateRange === preset.value 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            whileTap={{ scale: 0.95 }}
          >
            {preset.label}
          </motion.button>
        ))}
        
        {/* Custom Date Button */}
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <motion.button
            onClick={() => setIsOpen(true)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
              dateRange === 'custom' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            whileTap={{ scale: 0.95 }}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateRange === 'custom' && customStartDate && customEndDate 
              ? 'Custom' 
              : 'Pick Dates'
            }
          </motion.button>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Choose Date Range</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto">
              <CustomRangePicker />
            </div>
            <DrawerFooter className="pt-2 gap-2">
              <Button
                onClick={handleApplyCustomRange}
                disabled={!tempStartDate || !tempEndDate}
                className="w-full rounded-xl"
              >
                Apply Range
              </Button>
              {(tempStartDate || tempEndDate) && (
                <Button 
                  variant="ghost" 
                  onClick={handleClearCustomRange}
                  className="w-full text-muted-foreground"
                >
                  Clear
                </Button>
              )}
              <DrawerClose asChild>
                <Button variant="outline" className="w-full rounded-xl">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Active Custom Range Display */}
      {dateRange === 'custom' && customStartDate && customEndDate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center justify-between bg-primary/5 border border-primary/20 px-3 py-2 rounded-xl"
        >
          <span className="text-xs text-primary font-medium">
            {formatNigerianDate(customStartDate.toISOString())} → {formatNigerianDate(customEndDate.toISOString())}
          </span>
          <Button
            onClick={handleClearCustomRange}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-primary hover:text-primary hover:bg-primary/10 rounded-full"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}
    </div>
  );
};