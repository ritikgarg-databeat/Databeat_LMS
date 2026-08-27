import { BarChart3, BookOpen, ClipboardCheck, FileDown, Layers, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/constants/routes';

export interface AdminQuickActionsProps {
  pendingGradingCount: number;
}

interface AdminAction {
  label: string;
  icon: LucideIcon;
  to: string;
  badgeCount?: number;
}

function AdminQuickActions({ pendingGradingCount }: AdminQuickActionsProps) {
  const actions: AdminAction[] = [
    { label: 'Manage Trainers', icon: Users, to: ROUTES.ADMIN.TRAINERS },
    { label: 'Manage Groups', icon: Layers, to: ROUTES.ADMIN.GROUPS },
    { label: 'Course Catalogue', icon: BookOpen, to: ROUTES.ADMIN.CLASSROOM },
    {
      label: 'Assessments',
      icon: ClipboardCheck,
      to: ROUTES.ADMIN.ASSESSMENTS,
      badgeCount: pendingGradingCount,
    },
    { label: 'Executive Analysis', icon: BarChart3, to: ROUTES.ADMIN.LIVE_ANALYSIS },
    { label: 'Reports', icon: FileDown, to: ROUTES.ADMIN.REPORTS },
    { label: 'Audit Log', icon: ShieldCheck, to: ROUTES.ADMIN.AUDIT_LOG },
  ];

  return (
    <section className="space-y-3" aria-labelledby="admin-quick-actions-title">
      <h2 id="admin-quick-actions-title" className="text-lg font-semibold tracking-tight">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.badgeCount ? (
              <Badge variant="warning" className="absolute right-2 top-2">
                {action.badgeCount}
              </Badge>
            ) : null}
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <action.icon className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-medium leading-tight">{action.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export { AdminQuickActions };
