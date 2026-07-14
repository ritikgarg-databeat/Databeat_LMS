import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ROUTES } from '@/constants/routes';

export interface TrainerPendingGradingAlertProps {
  count: number;
}

/** Trainer dashboard pending-grading callout (Prompt 8) — only rendered when count > 0. */
function TrainerPendingGradingAlert({ count }: TrainerPendingGradingAlertProps) {
  if (count <= 0) return null;

  return (
    <Alert variant="warning">
      <ClipboardCheck aria-hidden />
      <AlertTitle>Grading needed</AlertTitle>
      <AlertDescription>
        <Link to={ROUTES.TRAINER.ASSESSMENTS} className="hover:underline">
          {count} {count === 1 ? 'attempt' : 'attempts'} awaiting manual grading →
        </Link>
      </AlertDescription>
    </Alert>
  );
}

export { TrainerPendingGradingAlert };
