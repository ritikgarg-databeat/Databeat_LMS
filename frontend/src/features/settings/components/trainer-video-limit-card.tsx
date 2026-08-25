import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/utils/error';

import { useTrainerVideoLimitQuery, useUpdateTrainerVideoLimitMutation } from '../hooks';
import type { TrainerVideoLimit } from '../types';

function TrainerVideoLimitCard() {
  const { data, isLoading } = useTrainerVideoLimitQuery();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainee AI video limit</CardTitle>
        <CardDescription>Control daily tutor-video usage for trainees in your active groups.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-24 w-full animate-none animate-shimmer" />
        ) : (
          <TrainerVideoLimitForm data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function TrainerVideoLimitForm({ data }: { data: TrainerVideoLimit }) {
  const mutation = useUpdateTrainerVideoLimitMutation();
  const [inherit, setInherit] = useState(data.dailyLimit === null);
  const [dailyLimit, setDailyLimit] = useState(data.dailyLimit ?? data.platformMaximum);

  const save = () => {
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > data.platformMaximum) {
      toast.error(`Enter a whole number from 0 to ${data.platformMaximum}.`);
      return;
    }
    mutation.mutate(inherit ? null : dailyLimit, {
      onSuccess: () => toast.success('Trainee video limit saved.'),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="inheritVideoLimit">Use platform maximum</Label>
          <p className="text-sm text-muted-foreground">
            Currently {data.platformMaximum} per trainee per day.
          </p>
        </div>
        <Switch id="inheritVideoLimit" checked={inherit} onCheckedChange={setInherit} />
      </div>
      {!inherit ? (
        <div className="space-y-2">
          <Label htmlFor="trainerVideoDailyLimit">Videos per trainee per day</Label>
          <Input
            id="trainerVideoDailyLimit"
            type="number"
            min={0}
            max={data.platformMaximum}
            value={dailyLimit}
            onChange={(event) => setDailyLimit(Number(event.target.value))}
          />
          <p className="text-sm text-muted-foreground">Set 0 to disable videos for your trainees.</p>
        </div>
      ) : null}
      <Button type="button" onClick={save} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save video limit'}
      </Button>
    </div>
  );
}

export { TrainerVideoLimitCard };
