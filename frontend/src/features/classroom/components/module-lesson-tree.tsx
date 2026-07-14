import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical, MoreHorizontal, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog, EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/error';

import { RESOURCE_TYPE_META } from '../constants';
import {
  useDeleteLessonMutation,
  useDeleteModuleMutation,
  useReorderLessonsMutation,
  useReorderModulesMutation,
  useUpdateLessonStatusMutation,
  useUpdateModuleStatusMutation,
} from '../hooks';
import type { CourseModule, CourseModuleWithLessons, Lesson } from '../types';

import { CreateLessonDialog } from './create-lesson-dialog';
import { EditLessonDialog } from './edit-lesson-dialog';
import { EditModuleDialog } from './edit-module-dialog';
import { LessonResourceManager } from './lesson-resource-manager';
import { ResourceTypeIcon } from './resource-type-icon';

export interface ModuleLessonTreeProps {
  courseId: string;
  modules: CourseModuleWithLessons[];
}

/**
 * Modules render as a `@dnd-kit` sortable list; each expandable module row nests its own
 * independent sortable list of lessons (its own `DndContext`, scoped to that module only —
 * lessons never drag across modules, matching `useReorderLessonsMutation`'s `moduleId`-scoped
 * payload).
 */
function ModuleLessonTree({ courseId, modules }: ModuleLessonTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [resourceLesson, setResourceLesson] = useState<Lesson | null>(null);
  const [deletingModule, setDeletingModule] = useState<CourseModuleWithLessons | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null);

  const reorderModules = useReorderModulesMutation();
  const updateModuleStatus = useUpdateModuleStatusMutation();
  const deleteModule = useDeleteModuleMutation();
  const updateLessonStatus = useUpdateLessonStatusMutation();
  const deleteLesson = useDeleteLessonMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedModules = useMemo(() => [...modules].sort((a, b) => a.order - b.order), [modules]);

  const toggleExpanded = (moduleId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const handleModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedModules.findIndex((module) => module.id === active.id);
    const newIndex = sortedModules.findIndex((module) => module.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sortedModules, oldIndex, newIndex);
    reorderModules.mutate(
      { courseId, orderedIds: reordered.map((module) => module.id) },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  const handleDeleteModule = async () => {
    if (!deletingModule) return;
    try {
      await deleteModule.mutateAsync({ id: deletingModule.id, courseId });
      toast.success(`${deletingModule.title} deleted.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingModule(null);
    }
  };

  const handleDeleteLesson = async () => {
    if (!deletingLesson) return;
    try {
      await deleteLesson.mutateAsync({ id: deletingLesson.id, moduleId: deletingLesson.moduleId });
      toast.success(`${deletingLesson.title} deleted.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingLesson(null);
    }
  };

  if (sortedModules.length === 0) {
    return <EmptyState title="No modules yet" description="Add a module to start building this course." />;
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
        <SortableContext items={sortedModules.map((module) => module.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sortedModules.map((module) => (
              <SortableModuleRow
                key={module.id}
                module={module}
                isExpanded={expandedIds.has(module.id)}
                onToggleExpand={() => toggleExpanded(module.id)}
                onEdit={() => setEditingModule(module)}
                onDelete={() => setDeletingModule(module)}
                onTogglePublish={() =>
                  updateModuleStatus.mutate(
                    { id: module.id, payload: { isPublished: !module.isPublished } },
                    {
                      onSuccess: () => toast.success(module.isPublished ? 'Module unpublished.' : 'Module published.'),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    },
                  )
                }
                onAddLesson={() => setAddLessonModuleId(module.id)}
                onEditLesson={setEditingLesson}
                onDeleteLesson={setDeletingLesson}
                onToggleLessonPublish={(lesson) =>
                  updateLessonStatus.mutate(
                    { id: lesson.id, payload: { isPublished: !lesson.isPublished } },
                    {
                      onSuccess: () => toast.success(lesson.isPublished ? 'Lesson unpublished.' : 'Lesson published.'),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    },
                  )
                }
                onManageResources={setResourceLesson}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <CreateLessonDialog
        moduleId={addLessonModuleId ?? ''}
        open={addLessonModuleId !== null}
        onOpenChange={(open) => {
          if (!open) setAddLessonModuleId(null);
        }}
      />

      <EditModuleDialog module={editingModule} onOpenChange={(open) => !open && setEditingModule(null)} />

      <EditLessonDialog lesson={editingLesson} onOpenChange={(open) => !open && setEditingLesson(null)} />

      <Drawer open={resourceLesson !== null} onOpenChange={(open) => !open && setResourceLesson(null)}>
        <DrawerContent className="mx-auto h-[85vh] w-full max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>Resources — {resourceLesson?.title}</DrawerTitle>
            <DrawerDescription>Upload files or add text/link/code resources for this lesson.</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {resourceLesson ? <LessonResourceManager lessonId={resourceLesson.id} /> : null}
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={deletingModule !== null}
        onOpenChange={(open) => !open && setDeletingModule(null)}
        title="Delete module"
        description={
          deletingModule
            ? `${deletingModule.title} and all of its lessons will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteModule()}
      />

      <ConfirmDialog
        open={deletingLesson !== null}
        onOpenChange={(open) => !open && setDeletingLesson(null)}
        title="Delete lesson"
        description={deletingLesson ? `${deletingLesson.title} will be permanently deleted. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteLesson()}
      />
    </>
  );
}

interface SortableModuleRowProps {
  module: CourseModuleWithLessons;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onToggleLessonPublish: (lesson: Lesson) => void;
  onManageResources: (lesson: Lesson) => void;
}

function SortableModuleRow({
  module,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onTogglePublish,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onToggleLessonPublish,
  onManageResources,
}: SortableModuleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={cn('rounded-lg border bg-card', isDragging && 'opacity-50 shadow-lg')}>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder ${module.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? `Collapse ${module.title}` : `Expand ${module.title}`}
          aria-expanded={isExpanded}
        >
          <ChevronRight className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{module.title}</p>
            <Badge variant={module.isPublished ? 'success' : 'secondary'}>
              {module.isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {module.lessons.length} lesson{module.lessons.length === 1 ? '' : 's'}
            {module.estimatedDurationMinutes ? ` • ${module.estimatedDurationMinutes} min` : ''}
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onAddLesson}>
          <Plus /> Add Lesson
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${module.title}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePublish}>{module.isPublished ? 'Unpublish' : 'Publish'}</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded ? (
        <div className="border-t px-3 py-2 pl-10">
          <LessonSortableList
            module={module}
            onEdit={onEditLesson}
            onDelete={onDeleteLesson}
            onTogglePublish={onToggleLessonPublish}
            onManageResources={onManageResources}
          />
        </div>
      ) : null}
    </div>
  );
}

interface LessonSortableListProps {
  module: CourseModuleWithLessons;
  onEdit: (lesson: Lesson) => void;
  onDelete: (lesson: Lesson) => void;
  onTogglePublish: (lesson: Lesson) => void;
  onManageResources: (lesson: Lesson) => void;
}

function LessonSortableList({ module, onEdit, onDelete, onTogglePublish, onManageResources }: LessonSortableListProps) {
  const reorderLessons = useReorderLessonsMutation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedLessons = useMemo(() => [...module.lessons].sort((a, b) => a.order - b.order), [module.lessons]);

  if (sortedLessons.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">No lessons yet. Add one to get started.</p>;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedLessons.findIndex((lesson) => lesson.id === active.id);
    const newIndex = sortedLessons.findIndex((lesson) => lesson.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sortedLessons, oldIndex, newIndex);
    reorderLessons.mutate(
      { moduleId: module.id, orderedIds: reordered.map((lesson) => lesson.id) },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedLessons.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1 py-1">
          {sortedLessons.map((lesson) => (
            <SortableLessonRow
              key={lesson.id}
              lesson={lesson}
              onEdit={() => onEdit(lesson)}
              onDelete={() => onDelete(lesson)}
              onTogglePublish={() => onTogglePublish(lesson)}
              onManageResources={() => onManageResources(lesson)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableLessonRowProps {
  lesson: Lesson;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onManageResources: () => void;
}

function SortableLessonRow({ lesson, onEdit, onDelete, onTogglePublish, onManageResources }: SortableLessonRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex flex-wrap items-center gap-2 rounded-md border bg-background p-2', isDragging && 'opacity-50 shadow-lg')}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${lesson.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <ResourceTypeIcon type={lesson.type} className="size-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{lesson.title}</p>
          <Badge variant={lesson.isPublished ? 'success' : 'secondary'}>
            {lesson.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {RESOURCE_TYPE_META[lesson.type].label}
          {lesson.estimatedDurationMinutes ? ` • ${lesson.estimatedDurationMinutes} min` : ''}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${lesson.title}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={onTogglePublish}>{lesson.isPublished ? 'Unpublish' : 'Publish'}</DropdownMenuItem>
          <DropdownMenuItem onClick={onManageResources}>Manage Resources</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { ModuleLessonTree };
