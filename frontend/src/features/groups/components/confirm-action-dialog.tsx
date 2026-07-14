// Archive/restore/delete/remove-member all need the exact same yes/no confirmation shape
// that `@/components/shared/confirm-dialog` already provides — re-exported under the feature's
// expected name rather than duplicating it.
export { ConfirmDialog as ConfirmActionDialog } from '@/components/shared';
export type { ConfirmDialogProps as ConfirmActionDialogProps } from '@/components/shared';
