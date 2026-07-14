import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorMessage } from '@/utils/error';

import { useBulkImportGroupMembersMutation } from '../hooks';
import type { BulkImportSummary } from '../types';

export interface BulkImportDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Does not auto-close on success — the admin needs to read the added/skipped/error summary first. */
function BulkImportDialog({ groupId, open, onOpenChange }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<BulkImportSummary | null>(null);
  const bulkImport = useBulkImportGroupMembersMutation();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFile(null);
      setSummary(null);
    }
    onOpenChange(next);
  };

  const onSubmit = async () => {
    if (!file) return;
    try {
      const result = await bulkImport.mutateAsync({ groupId, file });
      setSummary(result);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Members</DialogTitle>
          <DialogDescription>
            Upload a CSV file with an &quot;email&quot; column header to add multiple trainees at once.
          </DialogDescription>
        </DialogHeader>

        {!summary ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="bulk-import-file">CSV file</Label>
              <input
                id="bulk-import-file"
                type="file"
                accept=".csv,text/csv"
                disabled={bulkImport.isPending}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent text-sm shadow-sm file:mr-3 file:h-full file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium"
              />
            </div>
            <DialogFooter>
              <Button type="button" disabled={!file || bulkImport.isPending} onClick={() => void onSubmit()}>
                {bulkImport.isPending ? 'Importing...' : 'Import'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold">{summary.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total rows</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold text-success">{summary.added}</p>
                <p className="text-xs text-muted-foreground">Added</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold text-muted-foreground">{summary.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>

            {summary.errors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Errors</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.errors.map((error) => (
                      <TableRow key={`${error.row}-${error.email}`}>
                        <TableCell>{error.row}</TableCell>
                        <TableCell>{error.email}</TableCell>
                        <TableCell>{error.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { BulkImportDialog };
