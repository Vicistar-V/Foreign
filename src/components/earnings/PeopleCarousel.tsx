import { useState } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { PersonAvatarBubble } from './PersonAvatarBubble';
import { PersonDetailDrawer } from './PersonDetailDrawer';
import { UniqueEarner } from '@/hooks/useEarningsTimeline';
import { useAuth } from '@/hooks/useAuth';

interface PeopleCarouselProps {
  earners: UniqueEarner[];
}

export const PeopleCarousel = ({ earners }: PeopleCarouselProps) => {
  const { user } = useAuth();
  const [selectedPerson, setSelectedPerson] = useState<UniqueEarner | null>(null);

  if (earners.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center text-sm text-muted-foreground">
        No earners yet
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2 px-1">
          {earners.map((earner, index) => (
            <PersonAvatarBubble
              key={earner.user_id}
              earner={earner}
              isCurrentUser={user?.id === earner.user_id}
              index={index}
              onTap={() => setSelectedPerson(earner)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>

      <PersonDetailDrawer
        person={selectedPerson}
        isCurrentUser={selectedPerson?.user_id === user?.id}
        onClose={() => setSelectedPerson(null)}
      />
    </>
  );
};
