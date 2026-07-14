// "Profile" card for the settings pages: links out to the existing profile/change-password
// pages (Prompt 9 explicitly does not re-implement those forms here) plus the genuinely new
// avatar upload/remove UI, which has no home anywhere else in the app yet.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/utils/error';

import { useAuthenticatedAvatarUrl, useDeleteAvatarMutation, useUploadAvatarMutation } from '../hooks';

const ACCEPTED_AVATAR_MIME_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — mirrors the backend's own limit (see
// backend/src/constants/settings.ts MAX_AVATAR_SIZE_BYTES); this is just faster client feedback.

function ProfileSettingsCard() {
  const { user } = useAuth();
  const uploadAvatarMutation = useUploadAvatarMutation();
  const deleteAvatarMutation = useDeleteAvatarMutation();
  const { url: avatarUrl } = useAuthenticatedAvatarUrl(user?.avatar);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  if (!user) return null;

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  const hasAvatar = Boolean(user.avatar);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSizeError(null);
    if (file && file.size > MAX_AVATAR_SIZE_BYTES) {
      setSelectedFile(null);
      setSizeError('That image is larger than 2MB. Choose a smaller file.');
      event.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadAvatarMutation.mutate(selectedFile, {
      onSuccess: () => {
        toast.success('Avatar updated successfully.');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  const handleRemove = () => {
    deleteAvatarMutation.mutate(undefined, {
      onSuccess: () => toast.success('Avatar removed.'),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  const isBusy = uploadAvatarMutation.isPending || deleteAvatarMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your personal information, password, and photo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Name and email</p>
            <p className="text-sm text-muted-foreground">Manage your name and email address.</p>
          </div>
          <Button variant="outline" asChild>
            {/* Relative link: profile/settings are sibling routes nested under each role's
                layout (e.g. /trainer/profile, /trainer/settings). */}
            <Link to="../profile">Go to profile</Link>
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-sm text-muted-foreground">Change your password.</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="../change-password">Change password</Link>
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">Avatar</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_AVATAR_MIME_TYPES}
                disabled={isBusy}
                onChange={handleFileChange}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
              />
              {sizeError ? <p className="text-sm text-destructive">{sizeError}</p> : null}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedFile || isBusy}
                  onClick={handleUpload}
                >
                  {uploadAvatarMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
                {hasAvatar ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={handleRemove}
                  >
                    {deleteAvatarMutation.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { ProfileSettingsCard };
