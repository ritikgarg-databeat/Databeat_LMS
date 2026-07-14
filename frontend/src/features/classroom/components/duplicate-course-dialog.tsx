import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/utils/error';

import { useDuplicateCourseMutation } from '../hooks';
import type { Course } from '../types';

const duplicateCourseSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(150, 'Title must be 150 characters or fewer.'),
});
type DuplicateCourseFormValues = z.infer<typeof duplicateCourseSchema>;

export interface DuplicateCourseDialogProps {
  course: Course | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * On success, navigates straight to the duplicate's editor page — a duplicate exists to be
 * edited immediately, so landing on the list would just make the trainer click through again.
 */
function DuplicateCourseDialog({ course, onOpenChange }: DuplicateCourseDialogProps) {
  const duplicateCourse = useDuplicateCourseMutation();
  const navigate = useNavigate();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DuplicateCourseFormValues>({
    resolver: zodResolver(duplicateCourseSchema),
    values: course ? { title: `${course.title} (Copy)` } : undefined,
  });

  if (!course) return null;

  const onSubmit = async (values: DuplicateCourseFormValues) => {
    try {
      const duplicated = await duplicateCourse.mutateAsync({
        id: course.id,
        payload: { title: values.title },
      });
      toast.success('Course duplicated successfully.');
      onOpenChange(false);
      navigate(`${basePath}/classroom/${duplicated.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate {course.title}</DialogTitle>
          <DialogDescription>
            Creates a new draft copy with the same details — but no modules, lessons, or assigned
            groups. You&apos;ll be taken to the copy afterwards.
          </DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="duplicate-title">New title</Label>
            <Input id="duplicate-title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Duplicating...' : 'Duplicate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { DuplicateCourseDialog };
