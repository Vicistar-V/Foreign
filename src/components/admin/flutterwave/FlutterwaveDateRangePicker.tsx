import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, subMonths } from 'date-fns';

export interface DateRangeValue {
  fromDate: string | null;
  toDate: string | null;
}

interface FlutterwaveDateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

export const FlutterwaveDateRangePicker = ({ value, onChange }: FlutterwaveDateRangePickerProps) => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  
  // Format date for input (YYYY-MM-DD)
  const formatForInput = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
  };

  // Quick presets
  const presets = [
    {
      label: 'Today',
      getRange: () => ({
        fromDate: formatForInput(startOfDay(new Date())),
        toDate: formatForInput(endOfDay(new Date())),
      }),
    },
    {
      label: '7 Days',
      getRange: () => ({
        fromDate: formatForInput(subDays(new Date(), 7)),
        toDate: formatForInput(new Date()),
      }),
    },
    {
      label: '30 Days',
      getRange: () => ({
        fromDate: formatForInput(subDays(new Date(), 30)),
        toDate: formatForInput(new Date()),
      }),
    },
    {
      label: '3 Months',
      getRange: () => ({
        fromDate: formatForInput(subMonths(new Date(), 3)),
        toDate: formatForInput(new Date()),
      }),
    },
    {
      label: 'All Time',
      getRange: () => ({
        fromDate: '2020-01-01', // Far enough back to capture everything
        toDate: formatForInput(new Date()),
      }),
    },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    onChange(range);
    setIsCustomMode(false);
  };

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      fromDate: e.target.value || null,
    });
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      toDate: e.target.value || null,
    });
  };

  // Determine active preset
  const getActivePreset = (): string | null => {
    for (const preset of presets) {
      const range = preset.getRange();
      if (range.fromDate === value.fromDate && range.toDate === value.toDate) {
        return preset.label;
      }
    }
    return null;
  };

  const activePreset = getActivePreset();

  // Format display text
  const getDisplayText = (): string => {
    if (!value.fromDate && !value.toDate) {
      return 'All Data';
    }
    if (value.fromDate === '2020-01-01') {
      return 'All Time';
    }
    if (value.fromDate && value.toDate) {
      try {
        const from = new Date(value.fromDate);
        const to = new Date(value.toDate);
        return `${format(from, 'MMM d')} - ${format(to, 'MMM d, yyyy')}`;
      } catch {
        return 'Custom Range';
      }
    }
    return 'Custom Range';
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Pick Your Time Period</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {getDisplayText()}
          </span>
        </div>

        {/* Quick Preset Buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant={activePreset === preset.label ? 'default' : 'outline'}
              onClick={() => handlePresetClick(preset)}
              className="h-8 text-xs px-3"
            >
              {preset.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={isCustomMode && !activePreset ? 'default' : 'outline'}
            onClick={() => setIsCustomMode(!isCustomMode)}
            className="h-8 text-xs px-3"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Custom
          </Button>
        </div>

        {/* Custom Date Inputs - Show when custom mode is active */}
        {isCustomMode && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                From Date
              </label>
              <input
                type="date"
                value={value.fromDate || ''}
                onChange={handleFromDateChange}
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                To Date
              </label>
              <input
                type="date"
                value={value.toDate || ''}
                onChange={handleToDateChange}
                max={formatForInput(new Date())}
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
