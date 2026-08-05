'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DEFAULT_PRINT_TEMPLATE_FIELDS,
  DEFAULT_PRINT_TEMPLATE_NAMES,
  printDocumentTypes,
  printPaperSizes,
  type PrintDocumentType,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { ContentPanel } from '@/components/layout/content-panel';

type PrintTemplate = {
  id: string;
  type: PrintDocumentType;
  name: string;
  paperSize: string;
  fields: Record<string, boolean>;
  headerText: string | null;
  footerText: string | null;
  extraNote: string | null;
};

export function PrintTemplatesPanel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<PrintDocumentType>('fee_invoice');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['print-templates'],
    queryFn: () => apiClient<PrintTemplate[]>('/print-templates', { token }),
    enabled: !!token,
  });

  const selected = templates?.find((t) => t.type === selectedType) ?? null;
  const [draft, setDraft] = useState<PrintTemplate | null>(null);

  useEffect(() => {
    if (selected) setDraft({ ...selected, fields: { ...selected.fields } });
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<PrintTemplate>) =>
      apiClient(`/print-templates/${selected!.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Print template saved');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fieldKeys = Object.keys(
    draft?.fields ?? DEFAULT_PRINT_TEMPLATE_FIELDS[selectedType] ?? {},
  );

  return (
    <ContentPanel title="Print templates">
      <div className="space-y-4 px-5 py-5">
        <p className="text-sm text-[var(--text-sub-500)]">
          Choose paper size and which fields appear on fee vouchers, receipts, roll slips, and other
          printables. Use Print / Save as PDF from each document page.
        </p>

        <SelectDropdown
          aria-label="Document type"
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as PrintDocumentType)}
          options={printDocumentTypes.map((type) => ({
            value: type,
            label: DEFAULT_PRINT_TEMPLATE_NAMES[type],
          }))}
        />

        {isLoading || !draft ? (
          <p className="text-sm text-[var(--text-sub-500)]">Loading template…</p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-sub-500)]">Name</label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-sub-500)]">
                Paper size
              </label>
              <SelectDropdown
                aria-label="Paper size"
                value={draft.paperSize}
                onValueChange={(v) => setDraft({ ...draft, paperSize: v })}
                options={printPaperSizes.map((size) => ({
                  value: size,
                  label: size === 'thermal80' ? '80mm thermal' : size.toUpperCase(),
                }))}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {fieldKeys.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.fields[key])}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fields: { ...draft.fields, [key]: e.target.checked },
                      })
                    }
                  />
                  {key.replace(/^show/, '').replace(/([A-Z])/g, ' $1').trim()}
                </label>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-sub-500)]">
                Header text
              </label>
              <Input
                value={draft.headerText ?? ''}
                onChange={(e) => setDraft({ ...draft, headerText: e.target.value || null })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-sub-500)]">
                Footer text
              </label>
              <Input
                value={draft.footerText ?? ''}
                onChange={(e) => setDraft({ ...draft, footerText: e.target.value || null })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-sub-500)]">
                Extra note (e.g. bank / payment instructions)
              </label>
              <textarea
                value={draft.extraNote ?? ''}
                onChange={(e) => setDraft({ ...draft, extraNote: e.target.value || null })}
                className="min-h-[80px] w-full rounded-lg border border-[var(--stroke-soft-200)] px-3 py-2 text-sm"
              />
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({
                  name: draft.name,
                  paperSize: draft.paperSize as 'a4' | 'a5' | 'thermal80',
                  fields: draft.fields,
                  headerText: draft.headerText,
                  footerText: draft.footerText,
                  extraNote: draft.extraNote,
                })
              }
            >
              {saveMutation.isPending ? 'Saving…' : 'Save template'}
            </Button>
          </>
        )}
      </div>
    </ContentPanel>
  );
}
