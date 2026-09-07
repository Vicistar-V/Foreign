import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, ArrowDownLeft, ChevronRight, User, UserCheck } from 'lucide-react';
import { 
  FlutterwaveTransaction, 
  formatNaira, 
  getTransferStatusColor, 
  getSimpleStatusLabel,
  formatFlutterwaveDate 
} from '@/hooks/useFlutterwaveData';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';

interface FlutterwaveTransactionTableProps {
  transactions: FlutterwaveTransaction[] | undefined;
  isLoading: boolean;
  onSelectTransaction: (transaction: FlutterwaveTransaction) => void;
}

type FilterType = 'all' | 'successful' | 'failed' | 'pending';

export const FlutterwaveTransactionTable = ({ 
  transactions, 
  isLoading, 
  onSelectTransaction 
}: FlutterwaveTransactionTableProps) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewUser, setPreviewUser] = useState<{ name: string; avatar: string | null } | null>(null);

  const { filteredTransactions, counts } = useMemo(() => {
    if (!transactions) {
      return { filteredTransactions: [], counts: { all: 0, successful: 0, failed: 0, pending: 0 } };
    }
    
    const counts = {
      all: transactions.length,
      successful: transactions.filter(t => t.status === 'successful').length,
      failed: transactions.filter(t => t.status === 'failed').length,
      pending: transactions.filter(t => t.status === 'pending').length,
    };

    let list = transactions;
    
    // Apply status filter
    if (filter !== 'all') {
      list = list.filter(t => t.status === filter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(t => 
        t.tx_ref?.toLowerCase().includes(query) ||
        t.flw_ref?.toLowerCase().includes(query) ||
        t.customer?.name?.toLowerCase().includes(query) ||
        t.customer?.email?.toLowerCase().includes(query) ||
        t.matched_user?.full_name?.toLowerCase().includes(query)
      );
    }

    return { filteredTransactions: list, counts };
  }, [transactions, filter, searchQuery]);

  const filterButtons: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'successful', label: 'Done', count: counts.successful },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'failed', label: 'Failed', count: counts.failed },
  ];

  const handleAvatarClick = (e: React.MouseEvent, txn: FlutterwaveTransaction) => {
    e.stopPropagation();
    if (txn.matched_user) {
      setPreviewUser({
        name: txn.matched_user.full_name || txn.customer?.name || 'User',
        avatar: txn.matched_user.avatar_url,
      });
    }
  };

  const handleNameClick = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    navigate(`/admin/users/${userId}?from=flutterwave`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-success" />
              Money Received
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {transactions?.length || 0} deposits
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference, name, email..."
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

          {/* Transactions List */}
          <ScrollArea className="h-[320px] -mx-2 px-2">
            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ArrowDownLeft className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No deposits match your search' : 'No deposits found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((txn) => (
                  <button
                    key={txn.id}
                    onClick={() => onSelectTransaction(txn)}
                    className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    {/* Mobile-first stacked layout */}
                    <div className="space-y-2">
                      {/* Top row: Customer Avatar + Name + Amount */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Avatar - clickable if matched user */}
                          {txn.matched_user ? (
                            <button
                              onClick={(e) => handleAvatarClick(e, txn)}
                              className="shrink-0 relative"
                            >
                              <Avatar className="h-8 w-8 ring-2 ring-primary/30">
                                <AvatarImage src={txn.matched_user.avatar_url || undefined} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {getInitials(txn.matched_user.full_name || txn.customer?.name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                              {txn.matched_user.is_member && (
                                <UserCheck className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-success bg-background rounded-full" />
                              )}
                            </button>
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          
                          {/* Name - clickable if matched user */}
                          {txn.matched_user ? (
                            <button
                              onClick={(e) => handleNameClick(e, txn.matched_user!.user_id)}
                              className="font-medium text-sm truncate text-primary hover:underline text-left"
                            >
                              {txn.matched_user.full_name || txn.customer?.name || 'Unknown'}
                            </button>
                          ) : (
                            <p className="font-medium text-sm truncate">
                              {txn.customer?.name || 'Unknown'}
                            </p>
                          )}
                        </div>
                        <p className="font-bold text-sm text-success shrink-0">
                          +{formatNaira(txn.amount)}
                        </p>
                      </div>
                      
                      {/* Middle row: Email + Payment type */}
                      <p className="text-xs text-muted-foreground truncate">
                        {txn.customer?.email || 'No email'} • {txn.payment_type}
                      </p>
                      
                      {/* Bottom row: Date + Status + Arrow */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {formatFlutterwaveDate(txn.created_at)}
                        </p>
                        <div className="flex items-center gap-2">
                          {txn.matched_user && (
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                              Member
                            </Badge>
                          )}
                          <Badge 
                            variant="secondary" 
                            className={`text-[10px] ${getTransferStatusColor(txn.status)}`}
                          >
                            {getSimpleStatusLabel(txn.status)}
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

      {/* Avatar Preview Drawer */}
      <AvatarPreviewDrawer
        isOpen={!!previewUser}
        onClose={() => setPreviewUser(null)}
        name={previewUser?.name || ''}
        avatarUrl={previewUser?.avatar || null}
      />
    </>
  );
};
