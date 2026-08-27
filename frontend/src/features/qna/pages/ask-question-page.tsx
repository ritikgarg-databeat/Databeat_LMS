// Ask Question form. Mirrors the RHF + zodResolver wiring used everywhere else in this codebase
// (see change-password-page.tsx for the closest full-PAGE precedent, vs. the dialog-shaped forms
// in features/assessment|calendar).
//
// GROUP/DEPARTMENT visibility sourcing (verified live via curl against the backend, Prompt 7 §
// GROUP VISIBILITY):
//   - ORGANIZATION: always available, no groupId/departmentId allowed.
//   - GROUP: groupId required; a TRAINEE may use their own active groups, a TRAINER may use
//     active groups they own, and a SUPER_ADMIN may use any valid group.
//   - DEPARTMENT: departmentId required; a TRAINEE's departmentId must equal their own
//     `User.departmentId`, a TRAINER may use their own/owned-group departments, and a
//     SUPER_ADMIN may use any valid department.
//
// For DEPARTMENT, a TRAINEE's own departmentId is already on `useAuth().user` — so instead of a
// dropdown, it's silently auto-filled (see the effect below) and the option is disabled/hidden
// entirely when the trainee has no department.
//
// For GROUP, `GET /groups` is Trainer/Super-Admin-only and server-scoped, so a Trainee sources
// their own group options from `GET /groups/mine` instead (added alongside this page — see
// `useMyGroupsOptions` in features/groups/hooks — any authenticated role may call it, unlike the
// full list). Both roles land on the same dropdown; only the data source differs.
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { useMyCoursesQuery } from '@/features/classroom/hooks';
import { coursesApi } from '@/features/classroom/services';
import { departmentsApi } from '@/features/departments/services';
import { useMyGroupsOptions } from '@/features/groups/hooks';
import { groupsApi } from '@/features/groups/services';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/utils/error';

import { TagPicker } from '../components/tag-picker';
import { useCreateQuestionMutation } from '../hooks';
import type { CreateQuestionPayload, QnaVisibility } from '../types';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10000;
/** "Effectively all" page size for dropdown lookups — same convention as groups/services's departmentOptionsApi. */
const OPTIONS_PAGE_SIZE = 100;

const VISIBILITY_OPTIONS: { value: QnaVisibility; label: string; description: string }[] = [
  { value: 'ORGANIZATION', label: 'Organization', description: 'Visible to everyone in the organization.' },
  { value: 'GROUP', label: 'Group', description: 'Visible only to members of one group.' },
  { value: 'DEPARTMENT', label: 'Department', description: 'Visible only to one department.' },
];

const askQuestionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required.')
      .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required.')
      .max(MAX_DESCRIPTION_LENGTH, `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`),
    visibility: z.enum(['ORGANIZATION', 'GROUP', 'DEPARTMENT']),
    groupId: z.string().optional(),
    departmentId: z.string().optional(),
    courseId: z.string().optional(),
  })
  .refine((values) => values.visibility !== 'GROUP' || Boolean(values.groupId), {
    message: 'Select a group.',
    path: ['groupId'],
  })
  .refine((values) => values.visibility !== 'DEPARTMENT' || Boolean(values.departmentId), {
    message: 'Select a department.',
    path: ['departmentId'],
  });

type AskQuestionFormValues = z.infer<typeof askQuestionSchema>;

function AskQuestionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTraineeRoute = useLocation().pathname.startsWith('/trainee');
  const basePath = isTraineeRoute ? ROUTES.TRAINEE.QNA : ROUTES.TRAINER.QNA;

  const isPrivileged = user?.role === ROLES.TRAINER || user?.role === ROLES.SUPER_ADMIN;
  const departmentDisabled = !isPrivileged && !user?.departmentId;

  const [tags, setTags] = useState<string[]>([]);

  // Only fetched for TRAINER/SUPER_ADMIN — `GET /groups` and `GET /departments` are gated and
  // scoped for staff server-side, so firing them for a TRAINEE would just 403.
  // `useGroupsQuery`/`useDepartmentsQuery` don't expose `enabled`, hence the local `useQuery`
  // calls straight against the services here instead.
  const groupsQuery = useQuery({
    queryKey: ['qna-ask-group-options'],
    queryFn: () => groupsApi.list({ page: 1, pageSize: OPTIONS_PAGE_SIZE }),
    enabled: isPrivileged,
  });
  const departmentsQuery = useQuery({
    queryKey: ['qna-ask-department-options'],
    queryFn: () => departmentsApi.list({ page: 1, pageSize: OPTIONS_PAGE_SIZE }),
    enabled: isPrivileged,
  });
  // A Trainee sources their own group options from `GET /groups/mine` (any role may call it)
  // instead of the staff list.
  const myGroupsQuery = useMyGroupsOptions();
  const groupOptions: { id: string; name: string }[] = isPrivileged
    ? (groupsQuery.data?.items ?? [])
    : (myGroupsQuery.data ?? []);
  // Same reasoning for `GET /courses` (staff-only): a Trainer receives their own drafts plus the
  // published shared catalogue; a trainee gets assigned courses through `GET /courses/mine`.
  const privilegedCoursesQuery = useQuery({
    queryKey: ['qna-ask-course-options'],
    queryFn: () => coursesApi.list({ page: 1, pageSize: OPTIONS_PAGE_SIZE, status: 'PUBLISHED' }),
    enabled: isPrivileged,
  });
  const myCoursesQuery = useMyCoursesQuery();
  const courseOptions: { id: string; title: string }[] = isPrivileged
    ? (privilegedCoursesQuery.data?.items ?? [])
    : (myCoursesQuery.data ?? []);

  const createQuestion = useCreateQuestionMutation();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AskQuestionFormValues>({
    resolver: zodResolver(askQuestionSchema),
    defaultValues: { visibility: 'ORGANIZATION', groupId: '', departmentId: '', courseId: '' },
  });

  // `useWatch` rather than the destructured `watch()` — the latter is flagged by this codebase's
  // React Compiler lint rule (`react-hooks/incompatible-library`) as a function-returned-from-a-hook
  // that can't be memoized safely; `useWatch` is RHF's compiler-friendly equivalent.
  const visibility = useWatch({ control, name: 'visibility' });

  // A trainee's DEPARTMENT-visibility question can only ever target their own department, so
  // there's no dropdown for them — silently bind it to `user.departmentId` instead.
  useEffect(() => {
    if (visibility === 'DEPARTMENT' && !isPrivileged && user?.departmentId) {
      setValue('departmentId', user.departmentId, { shouldValidate: true });
    }
  }, [visibility, isPrivileged, user?.departmentId, setValue]);

  const onSubmit = async (values: AskQuestionFormValues) => {
    const payload: CreateQuestionPayload = {
      title: values.title,
      description: values.description,
      visibility: values.visibility,
      ...(values.visibility === 'GROUP' && values.groupId ? { groupId: values.groupId } : {}),
      ...(values.visibility === 'DEPARTMENT' && values.departmentId
        ? { departmentId: values.departmentId }
        : {}),
      ...(values.courseId ? { courseId: values.courseId } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    };

    try {
      const question = await createQuestion.mutateAsync(payload);
      toast.success('Question posted successfully.');
      // File attachments go through a separate endpoint that needs the question to already
      // exist (`POST /qna/questions/:id/attachments`) — so that happens on the detail page, not
      // here. Navigate straight there.
      navigate(`${basePath}/${question.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ask a Question</h1>
        <p className="text-muted-foreground">Get help from trainers and peers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" disabled={isSubmitting} {...register('title')} />
              {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={8} disabled={isSubmitting} {...register('description')} />
              {errors.description ? (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {VISIBILITY_OPTIONS.map((option) => {
                  const disabled = option.value === 'DEPARTMENT' && departmentDisabled;
                  const inputId = `visibility-${option.value.toLowerCase()}`;
                  const helperText =
                    option.value === 'DEPARTMENT' && departmentDisabled
                      ? 'Not available — you have no department assigned.'
                      : option.description;
                  return (
                    <div
                      key={option.value}
                      className={`flex items-start gap-2 rounded-md border p-3 ${disabled ? 'opacity-50' : ''}`}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        value={option.value}
                        className="mt-1 size-4"
                        disabled={disabled || isSubmitting}
                        {...register('visibility')}
                      />
                      <div>
                        <Label htmlFor={inputId} className={disabled ? '' : 'cursor-pointer'}>
                          {option.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{helperText}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {visibility === 'GROUP' ? (
              <div className="space-y-2">
                <Label htmlFor="groupId">Group</Label>
                <Controller
                  name="groupId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={isSubmitting}>
                      <SelectTrigger id="groupId">
                        <SelectValue placeholder="Select a group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {groupOptions.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {!isPrivileged && groupOptions.length === 0 && !myGroupsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    You are not currently a member of any group.
                  </p>
                ) : null}
                {errors.groupId ? <p className="text-sm text-destructive">{errors.groupId.message}</p> : null}
              </div>
            ) : null}

            {visibility === 'DEPARTMENT' ? (
              isPrivileged ? (
                <div className="space-y-2">
                  <Label htmlFor="departmentId">Department</Label>
                  <Controller
                    name="departmentId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger id="departmentId">
                          <SelectValue placeholder="Select a department..." />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentsQuery.data?.items.map((department) => (
                            <SelectItem key={department.id} value={department.id}>
                              {department.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.departmentId ? (
                    <p className="text-sm text-destructive">{errors.departmentId.message}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This question will be visible to your assigned department.
                </p>
              )
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="courseId">Related course (optional)</Label>
              <Controller
                name="courseId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="courseId">
                      <SelectValue placeholder="No course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No course</SelectItem>
                      {courseOptions.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (optional)</Label>
              <TagPicker value={tags} onChange={setTags} />
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Post Question'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export { AskQuestionPage };
