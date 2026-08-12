'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createLibraryBookSchema,
  createLibraryCopySchema,
  updateLibraryBookSchema,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { queryKeys } from '@/lib/query-keys';
import { useFormErrors } from '@/hooks/use-form-errors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
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
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  book: LibraryBook | null;
  categories: LibraryCategory[];
  copyStatuses?: string[];
  /** Called after a successful create/update so the list can reset filters/page. */
  onSaved?: (result: { created: boolean }) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!book;

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } = useFormErrors(
    isEdit ? updateLibraryBookSchema : createLibraryBookSchema,
  );

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      clearAll();
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
  }, [open, book, clearAll]);

  const buildPayload = () => {
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      publisher: form.publisher.trim() || undefined,
      edition: form.edition.trim() || undefined,
      isbn: form.isbn.trim() || undefined,
      accessionNo: form.accessionNo.trim() || undefined,
      categoryId: form.categoryId || null,
    };
    if (isEdit && book) return payload;
    return { branchId, ...payload };
  };

  const validateCopyCodes = (): boolean => {
    const copies = [form.copyCode1.trim(), form.copyCode2.trim()].filter(Boolean);
    for (let i = 0; i < copies.length; i++) {
      const result = createLibraryCopySchema.safeParse({ bookId: 'placeholder', copyCode: copies[i] });
      if (!result.success) {
        const copyError = result.error.issues.find((issue) => issue.path[0] === 'copyCode');
        if (copyError) {
          applyApiErrors({ [`copyCode${i + 1}`]: [copyError.message] });
          return false;
        }
      }
    }
    return true;
  };

  const mutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
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
      await queryClient.invalidateQueries({ queryKey: ['library-books', branchId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
      onSaved?.({ created: !isEdit });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to save book');
    },
  });

  const updateForm = (key: keyof typeof emptyForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearField(key);
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (!validate(payload)) return;
    if (!isEdit && !validateCopyCodes()) return;
    mutation.mutate(payload);
  };

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
                className={fieldClassName('title', modalFieldClassName)}
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
              />
              <FormFieldError message={errors.title} />
            </div>
            <div>
              <FormFieldLabel htmlFor="book-author">Author</FormFieldLabel>
              <input
                id="book-author"
                className={fieldClassName('author', modalFieldClassName)}
                value={form.author}
                onChange={(e) => updateForm('author', e.target.value)}
              />
              <FormFieldError message={errors.author} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel htmlFor="book-publisher">Publisher</FormFieldLabel>
                <input
                  id="book-publisher"
                  className={fieldClassName('publisher', modalFieldClassName)}
                  value={form.publisher}
                  onChange={(e) => updateForm('publisher', e.target.value)}
                />
                <FormFieldError message={errors.publisher} />
              </div>
              <div>
                <FormFieldLabel htmlFor="book-edition">Edition</FormFieldLabel>
                <input
                  id="book-edition"
                  className={fieldClassName('edition', modalFieldClassName)}
                  value={form.edition}
                  onChange={(e) => updateForm('edition', e.target.value)}
                />
                <FormFieldError message={errors.edition} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel htmlFor="book-isbn">ISBN</FormFieldLabel>
                <input
                  id="book-isbn"
                  className={fieldClassName('isbn', modalFieldClassName)}
                  value={form.isbn}
                  onChange={(e) => updateForm('isbn', e.target.value)}
                />
                <FormFieldError message={errors.isbn} />
              </div>
              <div>
                <FormFieldLabel htmlFor="book-accession">Accession no.</FormFieldLabel>
                <input
                  id="book-accession"
                  className={fieldClassName('accessionNo', modalFieldClassName)}
                  value={form.accessionNo}
                  onChange={(e) => updateForm('accessionNo', e.target.value)}
                />
                <FormFieldError message={errors.accessionNo} />
              </div>
            </div>
            <div>
              <FormFieldLabel htmlFor="book-category">Category</FormFieldLabel>
              <SelectDropdown
                aria-label="Category"
                placeholder="No category"
                value={form.categoryId}
                onValueChange={(v) => updateForm('categoryId', v)}
                options={[
                  { value: '', label: 'No category' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                className={fieldClassName('categoryId', 'w-full')}
              />
              <FormFieldError message={errors.categoryId} />
            </div>
            {!isEdit && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FormFieldLabel htmlFor="copy-1">Copy code 1</FormFieldLabel>
                  <input
                    id="copy-1"
                    className={fieldClassName('copyCode1', modalFieldClassName)}
                    placeholder="e.g. C-001"
                    value={form.copyCode1}
                    onChange={(e) => updateForm('copyCode1', e.target.value)}
                  />
                  <FormFieldError message={errors.copyCode1} />
                </div>
                <div>
                  <FormFieldLabel htmlFor="copy-2">Copy code 2</FormFieldLabel>
                  <input
                    id="copy-2"
                    className={fieldClassName('copyCode2', modalFieldClassName)}
                    placeholder="e.g. C-002"
                    value={form.copyCode2}
                    onChange={(e) => updateForm('copyCode2', e.target.value)}
                  />
                  <FormFieldError message={errors.copyCode2} />
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
            disabled={mutation.isPending}
            onClick={handleSave}
            className={cn(
              'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
              mutation.isPending && 'opacity-50',
            )}
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add book'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
