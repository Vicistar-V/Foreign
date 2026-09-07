import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ArrowUpRight, ChevronRight, Filter } from 'lucide-react';
import { 
  FlutterwaveTransfer, 
  formatNaira, 
  getTransferStatusColor, 
  getSimpleStatusLabel,
  formatFlutterwaveDate 
} from '@/hooks/useFlutterwaveData';
import { Skeleton } from '@/components/ui/skeleton';

interface FlutterwaveTransferTableProps {
  transfers: {
    all: FlutterwaveTransfer[];
    pending: FlutterwaveTransfer[];
    successful: FlutterwaveTransfer[];
    failed: FlutterwaveTransfer[];
  } | undefined;
  isLoading: boolean;
  onSelectTransfer: (transfer: FlutterwaveTransfer) => void;
}

type FilterType = 'all' | 'pending' | 'successful' | 'failed';

export const FlutterwaveTransferTable = ({ 
  transfers, 
  isLoading, 
  onSelectTransfer 
}: FlutterwaveTransferTableProps) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransfers = useMemo(() => {
    if (!transfers) return [];
    
    let list: FlutterwaveTransfer[] = [];
    
    switch (filter) {
      case 'pending':
        list = transfers.pending;
        break;
      case 'successful':
        list = transfers.successful;
        break;
      case 'failed':
        list = transfers.failed;
        break;
      default:
        list = transfers.all;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(t => 
        t.reference?.toLowerCase().includes(query) ||
        t.full_name?.toLowerCase().includes(query) ||
        t.account_number?.includes(query) ||
        t.bank_name?.toLowerCase().includes(query)
      );
    }

    return list;
  }, [transfers, filter, searchQuery]);

  const filterButtons: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: transfers?.all.length || 0 },
    { key: 'pending', label: 'Processing', count: transfers?.pending.length || 0 },
    { key: 'successful', label: 'Done', count: transfers?.successful.length || 0 },
    { key: 'failed', label: 'Problems', count: transfers?.failed.length || 0 },
  ];

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-primary" />
            Money Sent Out
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {transfers?.all.length || 0} transfers
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, account, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {filterButtons.map((btn) => (
            <Button
              key={btn.key}
              size="sm"
              variant={filter === btn.key ? 'default' : 'outline'}
              className="h-7 text-xs shrink-0"
              onClick={() => setFilter(btn.key)}
            >
              {btn.label}
              <span className="ml-1 opacity-70">({btn.count})</span>
            </Button>
          ))}
        </div>

        {/* Transfers List */}
        <ScrollArea className="h-[320px] -mx-2 px-2">
          {filteredTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ArrowUpRight className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No transfers match your search' : 'No transfers found'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransfers.map((transfer) => (
                <button
                  key={transfer.id}
                  onClick={() => onSelectTransfer(transfer)}
                  className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  {/* Mobile-first stacked layout */}
                  <div className="space-y-2">
                    {/* Top row: Name + Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm truncate flex-1 min-w-0">
                        {transfer.full_name || 'Unknown'}
                      </p>
                      <p className="font-bold text-sm shrink-0">
                        {formatNaira(transfer.amount)}
                      </p>
                    </div>
                    
                    {/* Middle row: Bank + Account */}
                    <p className="text-xs text-muted-foreground truncate">
                      {transfer.bank_name} • {transfer.account_number}
                    </p>
                    
                    {/* Bottom row: Date + Status + Arrow */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {formatFlutterwaveDate(transfer.created_at)}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] ${getTransferStatusColor(transfer.status)}`}
                        >
                          {getSimpleStatusLabel(transfer.status)}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
