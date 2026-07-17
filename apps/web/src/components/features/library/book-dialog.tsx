'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { cn } from '@/lib/utils';
import type { LibraryBook, LibraryCategory } from './types';

const emptyForm = {
  title: '',
  author: '',
  publisher: '',
  edition: '',
  isbn: '',
  accessionNo: '',
  categoryId: '',
  copyCode1: '',
  copyCode2: '',
};

export function BookDialog({
  open,
  onOpenChange,
  branchId,
  book,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  book: LibraryBook | null;
  categories: LibraryCategory[];
  copyStatuses?: string[];
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!book;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      return;
    }
    if (book) {
      setForm({
        title: book.title,
        author: book.author,
        publisher: book.publisher ?? '',
        edition: book.edition ?? '',
        isbn: book.isbn ?? '',
        accessionNo: book.accessionNo ?? '',
        categoryId: book.categoryId ?? '',
        copyCode1: '',
        copyCode2: '',
      });
    }
  }, [open, book]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.author.trim()) {
        throw new Error('Title and author are required');
      }
      const payload = {
        branchId,
        title: form.title.trim(),
        author: form.author.trim(),
        ...(form.publisher.trim() ? { publisher: form.publisher.trim() } : {}),
        ...(form.edition.trim() ? { edition: form.edition.trim() } : {}),
        ...(form.isbn.trim() ? { isbn: form.isbn.trim() } : {}),
        ...(form.accessionNo.trim() ? { accessionNo: form.accessionNo.trim() } : {}),
        ...(form.categoryId ? { categoryId: form.categoryId } : {}),
      };

      if (isEdit && book) {
        return apiClient(`/library/books/${book.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
      }

      const created = await apiClient<{ id: string }>('/library/books', {
        method: 'POST',
        token,
        body: payload,
      });

      const copies = [form.copyCode1.trim(), form.copyCode2.trim()].filter(Boolean);
      for (const copyCode of copies) {
        await apiClient('/library/copies', {
          method: 'POST',
          token,
          body: { bookId: created.id, copyCode },
        });
      }
      return created;
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Book updated' : 'Book added');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryBooks(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Unable to save book'),
  });

  const canSubmit = form.title.trim().length >= 1 && form.author.trim().length >= 1 && branchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <BookOpen className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit book' : 'Add book'}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? 'Update catalog book details' : 'Add a new book to the library catalog'}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-[var(--text-sub-500)] hover:bg-neutral-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <FormFieldLabel htmlFor="book-title">Title</FormFieldLabel>
              <input
                id="book-title"
                className={modalFieldClassName}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <FormFieldLabel htmlFor="book-author">Author</FormFieldLabel>
              <input
                id="book-author"
                className={modalFieldClassName}
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel htmlFor="book-publisher">Publisher</FormFieldLabel>
                <input
                  id="book-publisher"
                  className={modalFieldClassName}
                  value={form.publisher}
                  onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                />
              </div>
              <div>
                <FormFieldLabel htmlFor="book-edition">Edition</FormFieldLabel>
                <input
                  id="book-edition"
                  className={modalFieldClassName}
                  value={form.edition}
                  onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel htmlFor="book-isbn">ISBN</FormFieldLabel>
                <input
                  id="book-isbn"
                  className={modalFieldClassName}
                  value={form.isbn}
                  onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
                />
              </div>
              <div>
                <FormFieldLabel htmlFor="book-accession">Accession no.</FormFieldLabel>
                <input
                  id="book-accession"
                  className={modalFieldClassName}
                  value={form.accessionNo}
                  onChange={(e) => setForm((f) => ({ ...f, accessionNo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <FormFieldLabel htmlFor="book-category">Category</FormFieldLabel>
              <SelectDropdown
                aria-label="Category"
                placeholder="No category"
                value={form.categoryId}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                options={[
                  { value: '', label: 'No category' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                className="w-full"
              />
            </div>
            {!isEdit && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FormFieldLabel htmlFor="copy-1">Copy code 1</FormFieldLabel>
                  <input
                    id="copy-1"
                    className={modalFieldClassName}
                    placeholder="e.g. C-001"
                    value={form.copyCode1}
                    onChange={(e) => setForm((f) => ({ ...f, copyCode1: e.target.value }))}
                  />
                </div>
                <div>
                  <FormFieldLabel htmlFor="copy-2">Copy code 2</FormFieldLabel>
                  <input
                    id="copy-2"
                    className={modalFieldClassName}
                    placeholder="e.g. C-002"
                    value={form.copyCode2}
                    onChange={(e) => setForm((f) => ({ ...f, copyCode2: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className={cn(
              'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
              (!canSubmit || mutation.isPending) && 'opacity-50',
            )}
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add book'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
