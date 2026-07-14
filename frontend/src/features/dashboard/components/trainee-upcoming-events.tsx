import { ArrowRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import type { UpcomingEvent } from '@/features/analytics/types';
import { formatDate } from '@/utils/date';

export interface TraineeUpcomingEventsProps {
  events: UpcomingEvent[];
}

/** Dashboard calendar widget — sourced from `TraineeDashboard.upcomingEvents`, links to `/trainee/calendar`. */
function TraineeUpcomingEvents({ events }: TraineeUpcomingEventsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Upcoming Events</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINEE.CALENDAR}>
            Calendar <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-medium">{event.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{event.type}</Badge>
                  <span className="text-muted-foreground">{formatDate(event.startAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { TraineeUpcomingEvents };
