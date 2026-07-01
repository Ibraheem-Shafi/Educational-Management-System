const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'src', 'app', '(dashboard)', 'dashboard');
const routes = [
  'academic',
  'assessments',
  'timetable',
  'ai-attendance',
  'ai-insights',
  'reports',
];

const wrapper = (clientFile) => `import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./${clientFile}'));

export default function Page() {
  return <PageClient />;
}
`;

for (const route of routes) {
  const dir = path.join(base, route);
  const pagePath = path.join(dir, 'page.tsx');
  const slug = route.replace(/\//g, '-');
  const clientFile = `${slug}-client.tsx`;
  const clientPath = path.join(dir, clientFile);

  if (!fs.existsSync(pagePath)) {
    console.warn('skip', route);
    continue;
  }

  const content = fs.readFileSync(pagePath, 'utf8');
  if (content.includes('createDynamicPage')) {
    console.log('already split', route);
    continue;
  }

  fs.writeFileSync(clientPath, content);
  fs.writeFileSync(pagePath, wrapper(clientFile));
  console.log('split', route, '->', clientFile);
}
