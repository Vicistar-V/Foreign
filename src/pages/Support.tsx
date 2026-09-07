import { useState } from 'react';
import { HelpCircle, Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSEO } from '@/components/PageSEO';
import { TicketCard, NewTicketDrawer, TicketDetailDrawer } from '@/components/support';
import { useSupportTickets, type TicketCategory } from '@/hooks/useSupportTickets';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const Support = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { tickets, isLoading, createTicket, isCreating } = useSupportTickets({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const handleCreateTicket = (data: { subject: string; category: TicketCategory; message: string }) => {
    createTicket(data, {
      onSuccess: (res: any) => {
        setNewTicketOpen(false);
        // Open the conversation drawer immediately so the AI's first reply lands in view.
        if (res?.ticket_id) setSelectedTicketId(res.ticket_id);
      },
    });
  };

  const activeTickets = tickets.filter(t => !['resolved', 'closed'].includes(t.status));
  const resolvedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status));

  return (
    <>
      <PageSEO
        title="Get Help | Viketa"
        description="Need help with your Viketa ad share? Our support team is here 24/7 to assist you with any questions or issues."
        keywords="viketa help, viketa support, contact viketa, viketa customer service"
      />

      <div className="min-h-screen pb-24">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Get Help</h1>
              <p className="text-sm text-muted-foreground">We're here to help you</p>
            </div>
          </div>

          <Button 
            onClick={() => setNewTicketOpen(true)} 
            className="w-full" 
            size="lg"
            haptic
          >
            <Plus className="h-5 w-5 mr-2" />
            Ask for Help
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-4 mb-4">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
              <TabsTrigger value="resolved" className="flex-1">Solved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Ticket List */}
        <div className="px-4 space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-medium text-foreground mb-2">No Help Requests Yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                If you have any questions or problems, we're here to help!
              </p>
              <Button onClick={() => setNewTicketOpen(true)} haptic>
                <Plus className="h-4 w-4 mr-2" />
                Ask for Help
              </Button>
            </div>
          ) : (
            <>
              {statusFilter === 'all' && activeTickets.length > 0 && (
                <>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Active</h3>
                  {activeTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    />
                  ))}
                </>
              )}

              {statusFilter === 'all' && resolvedTickets.length > 0 && (
                <>
                  <h3 className="text-sm font-medium text-muted-foreground mt-6 mb-2">Solved</h3>
                  {resolvedTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    />
                  ))}
                </>
              )}

              {statusFilter !== 'all' && tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => setSelectedTicketId(ticket.id)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Drawers */}
      <NewTicketDrawer
        open={newTicketOpen}
        onOpenChange={setNewTicketOpen}
        onSubmit={handleCreateTicket}
        isLoading={isCreating}
      />

      <TicketDetailDrawer
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
      />
    </>
  );
};

export default Support;
