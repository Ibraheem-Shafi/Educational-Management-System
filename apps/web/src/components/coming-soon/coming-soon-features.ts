export type ComingSoonFeatureId =
  | 'communications'
  | 'ai-insights'
  | 'ai-attendance'
  | 'transport-gps'
  | 'biometric-integration'
  | 'portal-insights'
  | 'catalog-reports';

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
      'WhatsApp Business template delivery requires the institution’s Twilio keys. Event alerts are queued and logged until TWILIO_WHATSAPP_FROM is set; the family portal still shows notices.',
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
  'catalog-reports': {
    id: 'catalog-reports',
    title: 'Coming soon',
    description:
      'Named reports stay listed even when a module has no rows yet. Generate exports stored records as CSV.',
  },
};

export function getComingSoonFeature(id: ComingSoonFeatureId): ComingSoonFeature {
  return comingSoonFeatures[id];
}
