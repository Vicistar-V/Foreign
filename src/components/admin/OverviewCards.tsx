import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, Wallet, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';

interface OverviewCardsProps {
  totalUsers: number;
  totalMembers: number;
  totalUserBalances: number;
  isLoading?: boolean;
}

export const OverviewCards = ({
  totalUsers,
  totalMembers,
  totalUserBalances,
  isLoading,
}: OverviewCardsProps) => {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Users',
      value: totalUsers.toLocaleString(),
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
      tooltip: 'Total registered users on the platform',
      link: '/admin/users',
    },
    {
      title: 'Members',
      value: totalMembers.toLocaleString(),
      icon: UserCheck,
      color: 'text-success',
      bgColor: 'bg-success/10',
      tooltip: 'Activated paying members who can play',
      link: '/admin/users?membership=member',
    },
    {
      title: 'User Balances',
      value: `₦${totalUserBalances.toLocaleString()}`,
      icon: Wallet,
      color: 'text-accent-orange',
      bgColor: 'bg-accent-orange/10',
      tooltip: 'Total money in all user wallets - this is what the platform owes users',
      link: '/admin/users?sort=balance',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Tooltip key={card.title}>
              <TooltipTrigger asChild>
                <Card 
                  className="hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => navigate(card.link)}
                >
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs md:text-sm text-muted-foreground mb-0.5 truncate">
                            {card.title}
                          </p>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className={`text-lg md:text-2xl font-bold truncate ${card.color}`}>
                          {card.value}
                        </p>
                      </div>
                      <div className={`${card.bgColor} p-2 md:p-3 rounded-full shrink-0`}>
                        <Icon className={`h-4 w-4 md:h-5 md:w-5 ${card.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">{card.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

