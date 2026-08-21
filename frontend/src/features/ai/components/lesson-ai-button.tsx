// Entry point from a lesson into the AI chat, pre-scoped to that lesson via the `lessonId` query
// param. Self-gates to TRAINEE role so callers (e.g. `lesson-viewer-page.tsx`) don't need to
// remember to check — safe to render unconditionally from any role context.
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/use-auth';

export interface LessonAiButtonProps {
  lessonId: string;
}

function LessonAiButton({ lessonId }: LessonAiButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user?.role !== ROLES.TRAINEE) return null;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => navigate(`${ROUTES.TRAINEE.AI_TUTOR}?lessonId=${lessonId}`)}
    >
      <Sparkles /> Ask AI about this lesson
    </Button>
  );
}

export { LessonAiButton };
