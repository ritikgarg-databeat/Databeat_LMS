import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { BrandLogo, type SidebarNavItem } from '@/components/layout';
import { ROUTES } from '@/constants/routes';
import { DashboardLayout } from '@/layouts/dashboard-layout';

const TRAINEE_NAV_ITEMS: SidebarNavItem[] = [
  { label: 'Dashboard', href: ROUTES.TRAINEE.ROOT, icon: LayoutDashboard },
  { label: 'My Classroom', href: ROUTES.TRAINEE.CLASSROOM, icon: BookOpen },
  { label: 'Assessments', href: ROUTES.TRAINEE.ASSESSMENTS, icon: ClipboardList },
  { label: 'My Progress', href: ROUTES.TRAINEE.MY_PROGRESS, icon: TrendingUp },
  { label: 'Calendar', href: ROUTES.TRAINEE.CALENDAR, icon: CalendarDays },
  { label: 'Q&A', href: ROUTES.TRAINEE.QNA, icon: MessagesSquare },
  { label: 'AI Tutor', href: ROUTES.TRAINEE.AI_TUTOR, icon: Sparkles },
  { label: 'Settings', href: ROUTES.TRAINEE.SETTINGS, icon: Settings },
];

/** Trainee area shell. */
function TraineeLayout() {
  return (
    <DashboardLayout navItems={TRAINEE_NAV_ITEMS} brand={<BrandLogo label="Learn" />} />
  );
}

export { TraineeLayout };
