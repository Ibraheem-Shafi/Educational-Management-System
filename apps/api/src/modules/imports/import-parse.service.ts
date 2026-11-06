import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import type { ParseImportFileInput, PrepareImportUploadInput } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { RawSheetRow } from './import-row.util';

const IMPORTS_BUCKET = 'data-imports';
const MAX_ROWS = 50_000;
const SAMPLE_ROWS = 8;

@Injectable()
export class ImportParseService implements OnModuleInit {
  private readonly logger = new Logger(ImportParseService.name);
  private supabaseAdmin: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) this.supabaseAdmin = createClient(url, key);
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    if (!this.supabaseAdmin) return;
    try {
      const { data } = await this.supabaseAdmin.storage.getBucket(IMPORTS_BUCKET);
      if (!data) {
        await this.supabaseAdmin.storage.createBucket(IMPORTS_BUCKET, { public: false });
        this.logger.log(`Created storage bucket "${IMPORTS_BUCKET}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not verify/create bucket "${IMPORTS_BUCKET}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private safeFileName(name: string): string {
    const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '');
    return (base || 'file').slice(0, 120);
  }

  async prepareUpload(input: PrepareImportUploadInput, user: AuthUser) {
    if (!this.supabaseAdmin) {
      throw new BadRequestException(
        'File uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    await this.ensureBucket();
    const branchSeg = input.branchId ?? user.branchId ?? 'org';
    const path = `imports/${branchSeg}/${user.id}/${Date.now()}-${this.safeFileName(input.fileName)}`;
    const { data, error } = await this.supabaseAdmin.storage
      .from(IMPORTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Could not prepare import upload');
    }
    return {
      bucket: IMPORTS_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    if (!this.supabaseAdmin) {
      throw new BadRequestException('Storage is not configured');
    }
    const { data, error } = await this.supabaseAdmin.storage
      .from(IMPORTS_BUCKET)
      .download(filePath);
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Could not download import file');
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  async parseFile(input: ParseImportFileInput) {
    const buf = await this.downloadFile(input.filePath);
    return this.parseBuffer(buf, input.sheetName, input.headerRow ?? null);
  }

  parseBuffer(buf: Buffer, sheetName?: string | null, headerRow: number | null = null) {
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const sheets = wb.SheetNames;
    if (!sheets.length) throw new BadRequestException('Workbook has no sheets');
    const name = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0]!;
    const sheet = wb.Sheets[name];
    if (!sheet) throw new BadRequestException(`Sheet "${name}" not found`);

    const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];

    if (!matrix.length) {
      throw new BadRequestException('Sheet is empty');
    }

    const resolvedHeaderRow =
      headerRow == null ? detectHeaderRow(matrix) : headerRow;

    if (resolvedHeaderRow >= matrix.length) {
      throw new BadRequestException('Header row is beyond the end of the sheet');
    }

    const colCount = Math.max(
      ...(matrix.slice(resolvedHeaderRow, resolvedHeaderRow + 6).map((r) => r?.length ?? 0)),
      1,
    );

    const headerCells = Array.from({ length: colCount }, (_, i) => {
      const label = String(matrix[resolvedHeaderRow]?.[i] ?? '').trim();
      return label || `Col ${excelColLetter(i)}`;
    });

    // Deduplicate headers
    const seen = new Map<string, number>();
    const headers = headerCells.map((h) => {
      const n = (seen.get(h) ?? 0) + 1;
      seen.set(h, n);
      return n === 1 ? h : `${h} (${n})`;
    });

    const dataRows: RawSheetRow[] = [];
    for (let r = resolvedHeaderRow + 1; r < matrix.length; r++) {
      const line = matrix[r] ?? [];
      const obj: RawSheetRow = {};
      let any = false;
      for (let c = 0; c < headers.length; c++) {
        const val = line[c] ?? '';
        if (val !== '' && val != null) any = true;
        obj[headers[c]!] = val;
      }
      if (!any) continue;
      dataRows.push(obj);
      if (dataRows.length > MAX_ROWS) {
        throw new BadRequestException(`File exceeds maximum of ${MAX_ROWS.toLocaleString()} data rows`);
      }
    }

    const columnPreviews = headers.map((header, i) => {
      const samples: string[] = [];
      for (const row of dataRows) {
        if (samples.length >= 3) break;
        const raw = row[header];
        const s = String(raw ?? '').trim();
        if (!s) continue;
        if (!samples.includes(s)) samples.push(s.length > 40 ? `${s.slice(0, 37)}…` : s);
      }
      return {
        header,
        letter: excelColLetter(i),
        samples,
      };
    });

    return {
      sheets,
      sheetName: name,
      headerRow: resolvedHeaderRow,
      headerRowAutoDetected: headerRow == null,
      headers,
      columnPreviews,
      totalRows: dataRows.length,
      sampleRows: dataRows.slice(0, SAMPLE_ROWS),
      rows: dataRows,
    };
  }
}

function excelColLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function scoreHeaderCandidate(row: unknown[]): number {
  let filled = 0;
  let textish = 0;
  let numeric = 0;
  let longTitle = 0;
  const labels = new Set<string>();

  for (const cell of row) {
    const s = String(cell ?? '').trim();
    if (!s) continue;
    filled += 1;
    labels.add(s.toLowerCase());
    if (/^-?\d+(\.\d+)?$/.test(s) || /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(s)) {
      numeric += 1;
    } else {
      textish += 1;
      // Sheet titles are long; real headers are usually short labels
      if (s.length > 28 || /\b20\d{2}\s*[-–]\s*20\d{2}\b/.test(s)) longTitle += 1;
    }
  }

  // Title / banner rows: 0–1 filled cells
  if (filled < 2) return -1000 + filled;

  const uniqueness = labels.size / filled;
  const shortHeaderBonus = textish - longTitle;
  return (
    filled * 3 +
    shortHeaderBonus * 5 +
    uniqueness * filled * 3 -
    numeric * 4 -
    longTitle * 8
  );
}

/** Pick the row that looks most like column headers (not a title or data row). */
function detectHeaderRow(matrix: unknown[][]): number {
  const scan = Math.min(matrix.length, 25);
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let r = 0; r < scan; r++) {
    const score = scoreHeaderCandidate(matrix[r] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
    }
  }

  // If we landed on a sparse/title row, prefer the next denser row when it looks like headers
  if (bestScore < 8 && bestIdx + 1 < matrix.length) {
    const nextScore = scoreHeaderCandidate(matrix[bestIdx + 1] ?? []);
    if (nextScore > bestScore + 4) return bestIdx + 1;
  }

  return bestIdx;
}
