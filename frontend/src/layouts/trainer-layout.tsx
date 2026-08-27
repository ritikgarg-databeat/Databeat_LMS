import {
  BarChart3,
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
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';

import { BrandLogo, type SidebarNavItem } from '@/components/layout';
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
  { label: 'Team Performance', href: ROUTES.TRAINER.LIVE_ANALYSIS, icon: BarChart3 },
  { label: 'Reports', href: ROUTES.TRAINER.REPORTS, icon: FileDown },
  { label: 'Timing Observations', href: ROUTES.TRAINER.TIMING_OBSERVATIONS, icon: Timer },
  { label: 'Impact Metrics', href: ROUTES.TRAINER.IMPACT_METRICS, icon: TrendingUp },
  { label: 'Settings', href: ROUTES.TRAINER.SETTINGS, icon: Settings },
];

/** Trainer area shell. */
function TrainerLayout() {
  return <DashboardLayout navItems={TRAINER_NAV_ITEMS} brand={<BrandLogo label="Trainer" />} />;
}

export { TrainerLayout };
