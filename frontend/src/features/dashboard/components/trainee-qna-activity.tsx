import { ArrowRight, CircleHelp, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import type { QnaActivitySummary } from '@/features/analytics/types';

export interface TraineeQnaActivityProps {
  qnaActivity: QnaActivitySummary;
}

/** Compact dashboard Q&A stat row, linking through to `/trainee/qna`. */
function TraineeQnaActivity({ qnaActivity }: TraineeQnaActivityProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Q&amp;A Activity</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINEE.QNA}>
            Browse Q&amp;A <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleHelp className="size-3.5" aria-hidden /> Questions Asked
          </p>
          <p className="text-xl font-semibold tracking-tight">{qnaActivity.questionsAsked}</p>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageCircle className="size-3.5" aria-hidden /> Answers Received
          </p>
          <p className="text-xl font-semibold tracking-tight">{qnaActivity.answersReceived}</p>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden /> Verified Answers
          </p>
          <p className="text-xl font-semibold tracking-tight">{qnaActivity.verifiedAnswers}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export { TraineeQnaActivity };
