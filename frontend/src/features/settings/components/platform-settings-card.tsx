// "Platform Settings" card — SUPER_ADMIN only, new in Prompt 9. This is explicitly scoped as a
// configuration *foundation*: `maintenanceMode` is stored and editable here, but nothing else in
// the app currently reads/enforces it yet.
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/utils/error';

import { usePlatformSettingsQuery, useUpdatePlatformSettingsMutation } from '../hooks';
import type { PlatformSettings } from '../types';

// `maintenanceMode` is intentionally NOT part of the react-hook-form schema below: reading a
// boolean field's live value back out of RHF requires `watch()`, which (per this codebase's
// react-hooks/incompatible-library lint rule) React Compiler can't safely memoize. A plain Switch
// bound to local state sidesteps that; its value is merged into the submit payload alongside the
// RHF-managed text fields.
const platformSettingsSchema = z.object({
  platformName: z.string().min(1, 'Platform name is required.').max(120),
  supportEmail: z.string().email('Enter a valid email.').or(z.literal('')),
});
type PlatformSettingsFormValues = z.infer<typeof platformSettingsSchema>;

function PlatformSettingsCard() {
  const { data, isLoading } = usePlatformSettingsQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Settings</CardTitle>
        <CardDescription>Organization-wide configuration for Databeat LMS.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-full animate-none animate-shimmer" />
            <Skeleton className="h-9 w-full animate-none animate-shimmer" />
            <Skeleton className="h-6 w-40 animate-none animate-shimmer" />
          </div>
        ) : (
          <PlatformSettingsForm data={data} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Split out from `PlatformSettingsCard` so `maintenanceMode`'s local state can be lazily
 * initialized straight from the already-loaded `data` prop (`useState(() => data.maintenanceMode)`)
 * — this component only ever mounts once `data` exists, so that initializer runs exactly once,
 * with no `useEffect` needed to "sync" state in after the fact.
 */
function PlatformSettingsForm({ data }: { data: PlatformSettings }) {
  const updateMutation = useUpdatePlatformSettingsMutation();
  const [maintenanceMode, setMaintenanceMode] = useState(data.maintenanceMode);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlatformSettingsFormValues>({
    resolver: zodResolver(platformSettingsSchema),
    defaultValues: { platformName: data.platformName, supportEmail: data.supportEmail ?? '' },
  });

  const onSubmit = (values: PlatformSettingsFormValues) => {
    updateMutation.mutate(
      {
        platformName: values.platformName,
        supportEmail: values.supportEmail || null,
        maintenanceMode,
      },
      {
        onSuccess: () => toast.success('Platform settings saved.'),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <div className="space-y-2">
        <Label htmlFor="platformName">Platform name</Label>
        <Input id="platformName" disabled={updateMutation.isPending} {...register('platformName')} />
        {errors.platformName ? <p className="text-sm text-destructive">{errors.platformName.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="supportEmail">Support email</Label>
        <Input
          id="supportEmail"
          type="email"
          placeholder="support@example.com"
          disabled={updateMutation.isPending}
          {...register('supportEmail')}
        />
        {errors.supportEmail ? <p className="text-sm text-destructive">{errors.supportEmail.message}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="maintenanceMode">Maintenance mode</Label>
          <p className="text-sm text-muted-foreground">Marks the platform as under maintenance.</p>
        </div>
        <Switch
          id="maintenanceMode"
          checked={maintenanceMode}
          disabled={updateMutation.isPending}
          onCheckedChange={setMaintenanceMode}
        />
      </div>

      {maintenanceMode ? (
        <Alert variant="warning">
          <AlertTitle>Not yet enforced elsewhere</AlertTitle>
          <AlertDescription>
            Enabling maintenance mode is not yet enforced elsewhere in the app — this is a
            configuration foundation for a future maintenance-mode gate.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  );
}

export { PlatformSettingsCard };
