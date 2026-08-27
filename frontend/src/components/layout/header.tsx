import { Download, Menu, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/features/notifications/components';
import { useAuthenticatedAvatarUrl } from '@/features/settings/hooks';
import { useTheme } from '@/hooks/use-theme';

export interface HeaderProps {
  onMenuClick?: () => void;
  breadcrumbArea?: React.ReactNode;
  /** Optional content centered in the desktop header independently of left/right controls. */
  centerArea?: React.ReactNode;
  /** Display name supplied by the authenticated dashboard layout. */
  userLabel?: string;
  /** The current user's `avatar` field (a relative storage path, not a directly-fetchable URL). */
  avatarPath?: string | null;
  onLogout?: () => void;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Top app bar: mobile menu toggle, breadcrumb slot, notifications, theme toggle, user menu. */
function Header({
  onMenuClick,
  breadcrumbArea,
  centerArea,
  userLabel = 'Guest',
  avatarPath,
  onLogout,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { url: avatarUrl } = useAuthenticatedAvatarUrl(avatarPath);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  return (
    <header className="relative flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </Button>

      <div className="min-w-0 flex-1">{breadcrumbArea}</div>

      {centerArea ? (
        <div className="absolute left-1/2 hidden w-[46vw] max-w-3xl -translate-x-1/2 lg:block">
          {centerArea}
        </div>
      ) : null}

      {installPrompt ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Install Databeat LMS"
          onClick={() => {
            void installPrompt.prompt();
            void installPrompt.userChoice.finally(() => setInstallPrompt(null));
          }}
        >
          <Download className="size-4" />
        </Button>
      ) : null}

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle color theme">
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open user menu">
            <Avatar className="size-8">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback>{userLabel.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{userLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('profile')}>Profile</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('change-password')}>Change password</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} disabled={!onLogout}>
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export { Header };
