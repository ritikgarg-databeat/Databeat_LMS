import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Layers,
  Settings,
  Users,
} from 'lucide-react';

import { BrandLogo, type SidebarNavItem } from '@/components/layout';
import { ROUTES } from '@/constants/routes';
import { DashboardLayout } from '@/layouts/dashboard-layout';

// No "Security"/audit-log item here: there is no backend list endpoint for `AuditLog` (only a
// write-only `auditLogService` other modules call internally) and no frontend page for one, so a
// nav entry pointing at `/admin/security` was a dead 404 link — removed rather than left broken
// or backed by a fabricated placeholder page.
const ADMIN_NAV_ITEMS: SidebarNavItem[] = [
  { label: 'Dashboard', href: ROUTES.ADMIN.ROOT, icon: LayoutDashboard },
  { label: 'Classroom', href: ROUTES.ADMIN.CLASSROOM, icon: BookOpen },
  { label: 'Assessments', href: ROUTES.ADMIN.ASSESSMENTS, icon: ClipboardList },
  { label: 'Question Bank', href: ROUTES.ADMIN.QUESTIONS, icon: HelpCircle },
  { label: 'Calendar', href: ROUTES.ADMIN.CALENDAR, icon: CalendarDays },
  { label: 'Trainers', href: `${ROUTES.ADMIN.ROOT}/trainers`, icon: Users },
  { label: 'Departments', href: ROUTES.ADMIN.DEPARTMENTS, icon: Building2 },
  { label: 'Groups', href: ROUTES.ADMIN.GROUPS, icon: Layers },
  { label: 'Settings', href: `${ROUTES.ADMIN.ROOT}/settings`, icon: Settings },
];

/** Super Admin area shell. */
function AdminLayout() {
  return (
    <DashboardLayout navItems={ADMIN_NAV_ITEMS} brand={<BrandLogo label="Admin" />} />
  );
}

export { AdminLayout };
