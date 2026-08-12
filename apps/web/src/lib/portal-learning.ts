export const LEARNING_TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'note', label: 'Notes' },
  { value: 'material', label: 'Materials' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'homework', label: 'Homework' },
  { value: 'online_class', label: 'Live video class' },
] as const;

export function learningTypeLabel(type: string): string {
  switch (type) {
    case 'note':
      return 'Notes';
    case 'material':
      return 'Materials';
    case 'syllabus':
      return 'Syllabus';
    case 'homework':
      return 'Homework';
    case 'resource':
      return 'Resource';
    case 'online_class':
      return 'Live video class';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

export function formatLearningDueAt(dueAt: string | null | undefined): string {
  if (!dueAt) return '—';
  return new Date(dueAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatLearningDueDate(dueAt: string | null | undefined): string {
  if (!dueAt) return '—';
  return new Date(dueAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
