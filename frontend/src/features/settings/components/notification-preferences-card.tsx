// "Notifications" card: one Switch per `NotificationType`. The backend tracks which types are
// MUTED (`mutedTypes`); this UI inverts that so the switch reads naturally — ON means the user
// WILL receive that notification, i.e. the type is NOT in `mutedTypes`.
import { toast } from 'sonner';

import { ErrorScreen } from '@/components/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/utils/error';

import { useNotificationPreferencesQuery, useUpdateNotificationPreferencesMutation } from '../hooks';
import type { NotificationType } from '../types';

/** All 8 backend notification types, with clear, spec-aligned copy for this settings list. */
const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  {
    type: 'ASSESSMENT_ASSIGNED',
    label: 'New assessment assigned',
    description: 'When a trainer assigns you a new assessment.',
  },
  {
    type: 'ASSESSMENT_DEADLINE_APPROACHING',
    label: 'Assessment deadline approaching',
    description: 'When an assessment you still need to complete is due soon.',
  },
  {
    type: 'CALENDAR_EVENT_CREATED',
    label: 'New calendar event',
    description: 'When a new calendar event is created for you.',
  },
  {
    type: 'CALENDAR_EVENT_UPDATED',
    label: 'Calendar event updated',
    description: 'When a calendar event you were invited to changes.',
  },
  {
    type: 'QNA_ANSWER_POSTED',
    label: 'New answer to your question',
    description: 'When someone answers a question you asked.',
  },
  {
    type: 'QNA_ANSWER_VERIFIED',
    label: 'Your answer was verified',
    description: 'When a trainer verifies an answer you posted.',
  },
  {
    type: 'COURSE_ASSIGNED',
    label: 'New course assigned',
    description: 'When you are assigned a new course.',
  },
  {
    type: 'TRAINER_ANNOUNCEMENT',
    label: 'Trainer announcements',
    description: 'General announcements posted by a trainer.',
  },
];

function NotificationPreferencesCard() {
  const { data, isLoading, isError, refetch } = useNotificationPreferencesQuery();
  const updateMutation = useUpdateNotificationPreferencesMutation();

  const mutedTypes = data?.mutedTypes ?? [];

  const handleToggle = (type: NotificationType, enabled: boolean) => {
    const isCurrentlyMuted = mutedTypes.includes(type);
    // ON (enabled) means "not muted" -> remove from mutedTypes. OFF means "muted" -> add it,
    // guarding against a duplicate in case of a stale/racing toggle.
    const nextMutedTypes = enabled
      ? mutedTypes.filter((mutedType) => mutedType !== type)
      : isCurrentlyMuted
        ? mutedTypes
        : [...mutedTypes, type];

    updateMutation.mutate(nextMutedTypes, {
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose which notifications you want to receive.</CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorScreen
            className="min-h-32"
            message="Failed to load your notification preferences."
            onRetry={() => void refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose which notifications you want to receive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)
          : NOTIFICATION_TYPES.map(({ type, label, description }) => (
              <div key={type} className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor={`notification-${type}`}>{label}</Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={`notification-${type}`}
                  checked={!mutedTypes.includes(type)}
                  disabled={updateMutation.isPending}
                  onCheckedChange={(checked) => handleToggle(type, checked)}
                />
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

export { NotificationPreferencesCard };
