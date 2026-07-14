import { Menu, Moon, Sun } from 'lucide-react';
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
  /** Populated once the Authentication feature lands; a placeholder is shown until then. */
  userLabel?: string;
  /** The current user's `avatar` field (a relative storage path, not a directly-fetchable URL). */
  avatarPath?: string | null;
  onLogout?: () => void;
}

/** Top app bar: mobile menu toggle, breadcrumb slot, notifications, theme toggle, user menu. */
function Header({ onMenuClick, breadcrumbArea, userLabel = 'Guest', avatarPath, onLogout }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { url: avatarUrl } = useAuthenticatedAvatarUrl(avatarPath);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4">
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
