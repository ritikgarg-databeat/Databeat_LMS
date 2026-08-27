import { FileDown } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';

/** Trainer dashboard reports teaser (Prompt 8) — links to the CSV export page. */
function TrainerReportsTeaserCard({ reportsPath = ROUTES.TRAINER.REPORTS }: { reportsPath?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileDown className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Reports</p>
            <p className="text-sm text-muted-foreground">Export CSV reports for offline analysis.</p>
          </div>
        </div>
        <Link to={reportsPath} className="shrink-0 text-sm font-medium text-primary hover:underline">
          Export CSV reports →
        </Link>
      </CardContent>
    </Card>
  );
}

export { TrainerReportsTeaserCard };
