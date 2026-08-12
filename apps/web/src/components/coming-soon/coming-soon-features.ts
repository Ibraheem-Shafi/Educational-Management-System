export type ComingSoonFeatureId =
  | 'communications'
  | 'ai-insights'
  | 'ai-attendance'
  | 'transport-gps'
  | 'biometric-integration'
  | 'portal-insights';

export type ComingSoonFeature = {
  id: ComingSoonFeatureId;
  title: string;
  description: string;
};

export const comingSoonFeatures: Record<ComingSoonFeatureId, ComingSoonFeature> = {
  communications: {
    id: 'communications',
    title: 'Coming soon',
    description:
      'SMS and WhatsApp delivery is demo-only for now. You can explore the UI; real provider delivery is not live yet.',
  },
  'ai-insights': {
    id: 'ai-insights',
    title: 'Coming soon',
    description:
      'AI Insights is illustrative for demos. Scores and recommendations may be dummy or incomplete until production AI is enabled.',
  },
  'ai-attendance': {
    id: 'ai-attendance',
    title: 'Coming soon',
    description:
      'AI Attendance OCR depends on demo configuration. You can try the flow; results may be simulated or incomplete.',
  },
  'transport-gps': {
    id: 'transport-gps',
    title: 'Coming soon',
    description:
      'Live GPS tracking is simulated for demos. Positions and pings are not from production vehicle hardware yet.',
  },
  'biometric-integration': {
    id: 'biometric-integration',
    title: 'Coming soon',
    description:
      'Device webhook integration and test punches are demo tools. Production biometric hardware is not connected yet.',
  },
  'portal-insights': {
    id: 'portal-insights',
    title: 'Coming soon',
    description:
      'AI performance summaries are demo content for now. Treat figures and recommendations as illustrative only.',
  },
};

export function getComingSoonFeature(id: ComingSoonFeatureId): ComingSoonFeature {
  return comingSoonFeatures[id];
}
