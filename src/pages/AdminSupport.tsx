import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, AlertTriangle, Clock, CheckCircle, MessageCircle, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageSEO } from '@/components/PageSEO';
import { TicketCard, TicketDetailDrawer } from '@/components/support';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const AdminSupport = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleUserClick = (userId: string) => {
    navigate(`/admin/users/${userId}?from=support`);
  };

  const { tickets, stats, isLoading } = useSupportTickets({
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    search: debouncedSearch || undefined,
  });

  return (
    <>
      <PageSEO
        title="Help Desk | Admin"
        description="Reply to people who need help"
      />

      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Help Desk</h1>
            <p className="text-xs text-muted-foreground">People who need your help</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Card className="p-3 bg-card/50">
              <div className="flex items-center gap-2 text-warning mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Waiting</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{stats.open}</p>
            </Card>
            <Card className="p-3 bg-card/50">
              <div className="flex items-center gap-2 text-info mb-1">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Replying</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{stats.in_progress}</p>
            </Card>
            <Card className="p-3 bg-card/50">
              <div className="flex items-center gap-2 text-destructive mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Urgent</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{stats.urgent}</p>
            </Card>
            <Card className="p-3 bg-card/50">
              <div className="flex items-center gap-2 text-success mb-1">
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Solved</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{stats.resolved}</p>
            </Card>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, messages..."
              className="pl-9 h-10 text-sm bg-muted/30 border-none rounded-xl"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full md:w-40 h-10 text-sm bg-muted/30 border-none rounded-xl">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent only</SelectItem>
              <SelectItem value="normal">Normal only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
          <TabsList className="w-full h-auto p-1 bg-muted/30 rounded-xl flex overflow-x-auto no-scrollbar justify-start">
            <TabsTrigger value="all" className="flex-1 md:flex-none text-xs py-1.5 rounded-lg">All</TabsTrigger>
            <TabsTrigger value="open" className="flex-1 md:flex-none text-xs py-1.5 rounded-lg">Waiting</TabsTrigger>
            <TabsTrigger value="in_progress" className="flex-1 md:flex-none text-xs py-1.5 rounded-lg">Replying</TabsTrigger>
            <TabsTrigger value="waiting_user" className="flex-1 md:flex-none text-xs py-1.5 rounded-lg">Need reply</TabsTrigger>
            <TabsTrigger value="resolved" className="flex-1 md:flex-none text-xs py-1.5 rounded-lg">Solved</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3 pb-10">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </>
          ) : tickets.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Headphones className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="font-medium text-foreground text-sm">All caught up!</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                {statusFilter !== 'all' || priorityFilter !== 'all' || search
                  ? 'Try changing your filters'
                  : 'Nobody needs help right now.'}
              </p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => setSelectedTicketId(ticket.id)}
                showUser
                onUserClick={handleUserClick}
              />
            ))
          )}
        </div>
      </div>

      <TicketDetailDrawer
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
        onUserClick={handleUserClick}
      />
    </>
  );
};

export default AdminSupport;
