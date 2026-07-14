import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileDown,
  HelpCircle,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Users,
} from 'lucide-react';

import type { SidebarNavItem } from '@/components/layout';
import { ROUTES } from '@/constants/routes';
import { DashboardLayout } from '@/layouts/dashboard-layout';

const TRAINER_NAV_ITEMS: SidebarNavItem[] = [
  { label: 'Dashboard', href: ROUTES.TRAINER.ROOT, icon: LayoutDashboard },
  { label: 'Classroom', href: ROUTES.TRAINER.CLASSROOM, icon: BookOpen },
  { label: 'Assessments', href: ROUTES.TRAINER.ASSESSMENTS, icon: ClipboardList },
  { label: 'Question Bank', href: ROUTES.TRAINER.QUESTIONS, icon: HelpCircle },
  { label: 'Trainees', href: `${ROUTES.TRAINER.ROOT}/trainees`, icon: Users },
  { label: 'Departments', href: ROUTES.TRAINER.DEPARTMENTS, icon: Building2 },
  { label: 'Groups', href: ROUTES.TRAINER.GROUPS, icon: Layers },
  { label: 'Calendar', href: ROUTES.TRAINER.CALENDAR, icon: CalendarDays },
  { label: 'Q&A', href: ROUTES.TRAINER.QNA, icon: MessagesSquare },
  { label: 'Reports', href: ROUTES.TRAINER.REPORTS, icon: FileDown },
  { label: 'Settings', href: ROUTES.TRAINER.SETTINGS, icon: Settings },
];

/** Trainer area shell. */
function TrainerLayout() {
  return (
    <DashboardLayout
      navItems={TRAINER_NAV_ITEMS}
      brand={<span className="font-semibold">Databeat Trainer</span>}
    />
  );
}

export { TrainerLayout };
