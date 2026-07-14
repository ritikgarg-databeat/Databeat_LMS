import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConfirmDialog, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ACCEPTED_LESSON_FILE_TYPES, MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/error';
import { formatFileSize } from '@/utils/file';

import { RESOURCE_TYPE_META } from '../constants';
import {
  useCreateTextResourceMutation,
  useDownloadResource,
  useLessonResourcesQuery,
  useRemoveResourceMutation,
  useUploadResourceMutation,
} from '../hooks';
import type { LessonResource, ResourceType } from '../types';

import { ResourceTypeIcon } from './resource-type-icon';

// Mirrors `ResourceType` exactly — see create-lesson-dialog.tsx for the same convention.
const RESOURCE_TYPE_VALUES = [
  'MARKDOWN',
  'PDF',
  'VIDEO',
  'IMAGE',
  'PRESENTATION',
  'DOCUMENT',
  'ZIP',
  'EXTERNAL_LINK',
  'CODE_SNIPPET',
] as const satisfies readonly ResourceType[];

const FILE_BACKED_TYPES = RESOURCE_TYPE_VALUES.filter((type) => RESOURCE_TYPE_META[type].isFileBacked);
const TEXT_BACKED_TYPES = RESOURCE_TYPE_VALUES.filter((type) => !RESOURCE_TYPE_META[type].isFileBacked);
// `RESOURCE_TYPE_META` always contains at least one of each, but `noUncheckedIndexedAccess`
// can't infer that from a runtime `.filter()` — these fallbacks keep the defaults type-safe.
const DEFAULT_FILE_TYPE: ResourceType = FILE_BACKED_TYPES[0] ?? 'PDF';
const DEFAULT_TEXT_TYPE: ResourceType = TEXT_BACKED_TYPES[0] ?? 'MARKDOWN';

const CONTENT_PREVIEW_LENGTH = 160;

const resourceFormSchema = z
  .object({
    type: z.enum(RESOURCE_TYPE_VALUES),
    title: z.string().min(1, 'Title is required.').max(200, 'Title must be 200 characters or fewer.'),
    content: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (RESOURCE_TYPE_META[values.type].isFileBacked) return;
    if (!values.content || !values.content.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content'],
        message: values.type === 'EXTERNAL_LINK' ? 'URL is required.' : 'Content is required.',
      });
      return;
    }
    if (values.type === 'EXTERNAL_LINK') {
      try {
        // Validated for its side effect only — an invalid URL throws, a valid one doesn't.
        new URL(values.content);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['content'],
          message: 'Enter a valid URL (e.g. https://example.com).',
        });
      }
    }
  });
type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export interface LessonResourceManagerProps {
  lessonId: string;
}

/** Lists a lesson's resources and provides an "add resource" form (upload vs text/link/code). */
function LessonResourceManager({ lessonId }: LessonResourceManagerProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [deletingResource, setDeletingResource] = useState<LessonResource | null>(null);

  const { data: resources, isLoading } = useLessonResourcesQuery(lessonId);
  const uploadResource = useUploadResourceMutation();
  const createTextResource = useCreateTextResourceMutation();
  const removeResource = useRemoveResourceMutation();
  const downloadResource = useDownloadResource();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { type: DEFAULT_FILE_TYPE, title: '', content: '' },
  });
  // `useWatch` (a real hook) rather than `watch()` (a closure returned from `useForm`) — the
  // latter trips the React Compiler's "incompatible library" lint rule since it can't verify
  // the closure is safe to memoize.
  const selectedType = useWatch({ control, name: 'type' });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_LESSON_FILE_TYPES,
    maxSize: MAX_LESSON_FILE_SIZE_BYTES,
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) setFile(acceptedFiles[0]);
    },
    onDropRejected: (rejections) => {
      const message = rejections[0]?.errors[0]?.message ?? 'That file could not be added.';
      toast.error(message);
    },
  });

  const handleTabChange = (value: string) => {
    const nextTab = value === 'text' ? 'text' : 'file';
    setActiveTab(nextTab);
    setValue('type', nextTab === 'file' ? DEFAULT_FILE_TYPE : DEFAULT_TEXT_TYPE);
    setValue('content', '');
    setFile(null);
  };

  const onSubmit = async (values: ResourceFormValues) => {
    if (RESOURCE_TYPE_META[values.type].isFileBacked) {
      if (!file) {
        toast.error('Choose a file to upload.');
        return;
      }
      try {
        await uploadResource.mutateAsync({ lessonId, payload: { title: values.title, type: values.type, file } });
        toast.success('Resource uploaded successfully.');
      } catch (error) {
        toast.error(getErrorMessage(error));
        return;
      }
    } else {
      try {
        await createTextResource.mutateAsync({
          lessonId,
          payload: { type: values.type, title: values.title, content: values.content ?? '' },
        });
        toast.success('Resource added successfully.');
      } catch (error) {
        toast.error(getErrorMessage(error));
        return;
      }
    }
    reset({ type: activeTab === 'file' ? DEFAULT_FILE_TYPE : DEFAULT_TEXT_TYPE, title: '', content: '' });
    setFile(null);
  };

  const handleDownload = (resource: LessonResource) => {
    void downloadResource(lessonId, resource.id, resource.originalFilename ?? resource.title);
  };

  const handleDelete = async () => {
    if (!deletingResource) return;
    try {
      await removeResource.mutateAsync({ lessonId, resourceId: deletingResource.id });
      toast.success(`${deletingResource.title} removed.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingResource(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Current resources</h3>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : !resources?.length ? (
          <EmptyState title="No resources yet" description="Add a file, text, link, or code snippet below." />
        ) : (
          <ul className="space-y-2">
            {resources.map((resource) => {
              const meta = RESOURCE_TYPE_META[resource.type];
              const preview =
                resource.content && resource.content.length > CONTENT_PREVIEW_LENGTH
                  ? `${resource.content.slice(0, CONTENT_PREVIEW_LENGTH)}…`
                  : resource.content;
              return (
                <li key={resource.id} className="flex items-start gap-3 rounded-md border p-3">
                  <ResourceTypeIcon type={resource.type} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{resource.title}</p>
                    {meta.isFileBacked ? (
                      <p className="text-xs text-muted-foreground">
                        {resource.originalFilename ?? meta.label}
                        {resource.fileSizeBytes !== null ? ` • ${formatFileSize(resource.fileSizeBytes)}` : ''}
                      </p>
                    ) : resource.type === 'EXTERNAL_LINK' && resource.content ? (
                      <a
                        href={resource.content}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-primary underline"
                      >
                        {resource.content}
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">{preview}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {meta.isFileBacked ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Download ${resource.title}`}
                        onClick={() => handleDownload(resource)}
                      >
                        <Download className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${resource.title}`}
                      onClick={() => setDeletingResource(resource)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Add resource</h3>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="file">Upload file</TabsTrigger>
              <TabsTrigger value="text">Add text / link / code</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resource-type-file">Resource type</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <SelectTrigger id="resource-type-file">
                        <SelectValue placeholder="Select a resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        {FILE_BACKED_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {RESOURCE_TYPE_META[type].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div
                {...getRootProps()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                  isDragActive ? 'border-primary bg-accent' : 'border-input hover:bg-accent/50',
                )}
              >
                <input {...getInputProps()} />
                <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
                {file ? (
                  <p className="text-sm font-medium">
                    {file.name} <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop the file here...' : 'Drag & drop a file here, or click to browse'}
                    </p>
                    <p className="text-xs text-muted-foreground">Max size {formatFileSize(MAX_LESSON_FILE_SIZE_BYTES)}</p>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resource-type-text">Resource type</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <SelectTrigger id="resource-type-text">
                        <SelectValue placeholder="Select a resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEXT_BACKED_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {RESOURCE_TYPE_META[type].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {selectedType === 'EXTERNAL_LINK' ? (
                <div className="space-y-2">
                  <Label htmlFor="resource-content-url">URL</Label>
                  <Input
                    id="resource-content-url"
                    type="url"
                    placeholder="https://example.com/resource"
                    disabled={isSubmitting}
                    {...register('content')}
                  />
                  {errors.content ? <p className="text-sm text-destructive">{errors.content.message}</p> : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="resource-content-text">Content</Label>
                  <Textarea id="resource-content-text" rows={6} disabled={isSubmitting} {...register('content')} />
                  {errors.content ? <p className="text-sm text-destructive">{errors.content.message}</p> : null}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="resource-title">Title</Label>
            <Input id="resource-title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Resource'}
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={deletingResource !== null}
        onOpenChange={(open) => !open && setDeletingResource(null)}
        title="Delete resource"
        description={
          deletingResource ? `${deletingResource.title} will be permanently deleted. This cannot be undone.` : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export { LessonResourceManager };
