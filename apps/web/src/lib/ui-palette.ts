export const PALETTE_CYCLE = ['teal', 'orange', 'yellow', 'green', 'coral', 'purple'] as const;

export type PaletteName = (typeof PALETTE_CYCLE)[number];

export const PALETTE_CSS: Record<PaletteName | 'navy', string> = {
  navy: 'var(--palette-navy)',
  teal: 'var(--palette-teal)',
  orange: 'var(--palette-orange)',
  yellow: 'var(--palette-yellow)',
  green: 'var(--palette-green)',
  coral: 'var(--palette-coral)',
  purple: 'var(--palette-purple)',
};

export const PALETTE_SOFT_CSS: Record<PaletteName, string> = {
  teal: 'var(--palette-teal-soft)',
  orange: 'var(--palette-orange-soft)',
  yellow: 'var(--palette-yellow-soft)',
  green: 'var(--palette-green-soft)',
  coral: 'var(--palette-coral-soft)',
  purple: 'var(--palette-purple-soft)',
};

export const CHART_STOPS: Array<{ offset: string; color: string }> = [
  { offset: '0%', color: 'var(--chart-stop-1)' },
  { offset: '20%', color: 'var(--chart-stop-2)' },
  { offset: '40%', color: 'var(--chart-stop-3)' },
  { offset: '60%', color: 'var(--chart-stop-4)' },
  { offset: '80%', color: 'var(--chart-stop-5)' },
  { offset: '100%', color: 'var(--chart-stop-6)' },
];

/** Label-based accents so accountant/fee KPIs stay intentional, not index-shifted. */
export const STAT_ACCENT: Record<string, PaletteName> = {
  'Total Branches': 'teal',
  'Branches under you': 'teal',
  'Total Students': 'orange',
  'Active Students': 'green',
  'Inactive Students': 'coral',
  'Total Batches': 'yellow',
  'Teachers & Staff': 'yellow',
  'Total Classes': 'green',
  'Total Parents': 'coral',
  'Total parents': 'coral',
  'Linked students': 'orange',
  'Unlinked parents': 'yellow',
  'New (30d)': 'teal',
  'Total Users': 'purple',
  Outstanding: 'coral',
  'Collected (30d)': 'teal',
  'Overdue Invoices': 'coral',
  'Invoices Issued': 'purple',
  "Today's rate": 'teal',
  'Month average': 'orange',
  'Present today': 'green',
  'Absent today': 'coral',
  Published: 'teal',
  Drafts: 'yellow',
  Homework: 'orange',
  'Due soon': 'coral',
  'Total files': 'teal',
  'Recent uploads': 'orange',
  'Student documents': 'green',
  'Other documents': 'purple',
};

const STAT_KEYWORD_ACCENT: Array<[string, PaletteName]> = [
  ['branch', 'teal'],
  ['student', 'orange'],
  ['teacher', 'yellow'],
  ['staff', 'yellow'],
  ['class', 'green'],
  ['parent', 'coral'],
  ['user', 'purple'],
  ['outstanding', 'coral'],
  ['overdue', 'coral'],
  ['absent', 'coral'],
  ['collect', 'teal'],
  ['revenue', 'teal'],
  ['present', 'green'],
  ['success', 'green'],
  ['invoice', 'purple'],
  ['report', 'purple'],
  ['homework', 'orange'],
  ['pending', 'yellow'],
  ['draft', 'yellow'],
  ['leave', 'yellow'],
  ['exam', 'purple'],
  ['fee', 'coral'],
];

export const NAV_ACCENT: Record<string, PaletteName> = {
  '/dashboard': 'teal',
  '/dashboard/students': 'orange',
  '/dashboard/parents': 'coral',
  '/dashboard/users': 'purple',
  '/dashboard/front-office': 'yellow',
  '/dashboard/academic': 'green',
  '/dashboard/academic-ops': 'green',
  '/dashboard/assessments': 'orange',
  '/dashboard/timetable': 'teal',
  '/dashboard/learning': 'purple',
  '/dashboard/attendance': 'green',
  '/dashboard/leave-requests': 'yellow',
  '/dashboard/fees': 'coral',
  '/dashboard/accounting': 'teal',
  '/dashboard/finance-ops': 'coral',
  '/dashboard/payroll': 'orange',
  '/dashboard/library': 'green',
  '/dashboard/transport': 'yellow',
  '/dashboard/biometric': 'purple',
  '/dashboard/documents': 'teal',
  '/dashboard/certificates': 'coral',
  '/dashboard/analytics': 'orange',
  '/dashboard/reports': 'purple',
  '/dashboard/reports/academic': 'green',
  '/dashboard/reports/finance': 'coral',
  '/dashboard/reports/administration': 'yellow',
  '/dashboard/ai-insights': 'teal',
  '/dashboard/ai-attendance': 'green',
  '/dashboard/notices': 'yellow',
  '/dashboard/communications': 'coral',
  '/dashboard/branches': 'teal',
  '/dashboard/audit': 'orange',
  '/dashboard/settings': 'purple',
  '/dashboard/campus-ops': 'yellow',
  '/dashboard/hr': 'purple',
  '/dashboard/form-fields': 'green',
  '/portal/student': 'teal',
  '/portal/parent': 'teal',
  '/portal/student/attendance': 'green',
  '/portal/parent/attendance': 'green',
  '/portal/student/assessments': 'orange',
  '/portal/parent/assessments': 'orange',
  '/portal/student/fees': 'coral',
  '/portal/parent/fees': 'coral',
  '/portal/student/timetable': 'teal',
  '/portal/parent/timetable': 'teal',
  '/portal/student/notices': 'yellow',
  '/portal/parent/notices': 'yellow',
  '/portal/student/learning': 'purple',
  '/portal/parent/learning': 'green',
  '/portal/student/documents': 'teal',
  '/portal/parent/documents': 'teal',
  '/portal/student/calendar': 'orange',
  '/portal/parent/calendar': 'orange',
  '/portal/student/insights': 'purple',
  '/portal/parent/children': 'orange',
  '/portal/parent/leave': 'yellow',
};

export const ACTIVITY_ACCENT: Record<string, PaletteName> = {
  student: 'green',
  teacher: 'orange',
  fee: 'purple',
  attendance: 'teal',
  branch: 'yellow',
  report: 'coral',
};

export function paletteColor(name: PaletteName | 'navy'): string {
  return PALETTE_CSS[name];
}

export function paletteSoft(name: PaletteName): string {
  return PALETTE_SOFT_CSS[name];
}

export function paletteAt(index: number): PaletteName {
  return PALETTE_CYCLE[((index % PALETTE_CYCLE.length) + PALETTE_CYCLE.length) % PALETTE_CYCLE.length];
}

export function paletteCssAt(index: number): string {
  return PALETTE_CSS[paletteAt(index)];
}

function hashToPalette(value: string): PaletteName {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash + value.charCodeAt(i)) % PALETTE_CYCLE.length;
  }
  return PALETTE_CYCLE[hash];
}

export function accentForLabel(label: string, fallbackIndex = 0): PaletteName {
  const exact = STAT_ACCENT[label];
  if (exact) return exact;
  const lower = label.toLowerCase();
  for (const [key, value] of Object.entries(STAT_ACCENT)) {
    if (key.toLowerCase() === lower) return value;
  }
  for (const [keyword, name] of STAT_KEYWORD_ACCENT) {
    if (lower.includes(keyword)) return name;
  }
  return paletteAt(fallbackIndex);
}

export function accentForSeed(value: string): PaletteName {
  return hashToPalette(value);
}

export function accentForHref(href: string): PaletteName {
  return NAV_ACCENT[href] ?? hashToPalette(href);
}

export function accentForActivity(kind: string, fallbackIndex = 0): PaletteName {
  return ACTIVITY_ACCENT[kind] ?? paletteAt(fallbackIndex);
}
