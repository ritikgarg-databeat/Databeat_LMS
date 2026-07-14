// Renders a question's attachments with an authenticated blob-download workaround. The
// download endpoint requires the same in-memory bearer token as every other `/qna/*` call, so a
// plain `<a href>` would 401 — see `qnaQuestionsApi.getAttachmentDownloadUrl`'s doc-comment (and
// `features/classroom/hooks/index.ts`'s `useDownloadResource` for the same pattern already used
// elsewhere in this codebase) for why this fetches the file as a blob via `apiClient` instead.
import { Download, Paperclip, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/api/client';
import { getErrorMessage } from '@/utils/error';
import { formatFileSize } from '@/utils/file';

import { qnaQuestionsApi } from '../services';
import type { QnaAttachment } from '../types';

export interface AttachmentListProps {
  attachments: QnaAttachment[];
  questionId: string;
  canRemove?: boolean;
  onRemove?: (attachmentId: string) => void;
}

function AttachmentList({ attachments, questionId, canRemove = false, onRemove }: AttachmentListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!attachments.length) return null;

  const handleDownload = async (attachment: QnaAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const url = qnaQuestionsApi.getAttachmentDownloadUrl(questionId, attachment.id);
      const response = await apiClient.get<Blob>(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      try {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-medium">{attachment.fileName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(attachment.fileSizeBytes)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDownload(attachment)}
              disabled={downloadingId === attachment.id}
            >
              <Download className="size-3.5" />
              {downloadingId === attachment.id ? 'Downloading...' : 'Download'}
            </Button>
            {canRemove && onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${attachment.fileName}`}
                onClick={() => onRemove(attachment.id)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export { AttachmentList };
