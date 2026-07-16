import * as fs from 'fs';
import * as path from 'path';
import type { DemoConfig } from './types';

export function loadDemoConfig(configPath?: string): DemoConfig {
  const resolved = configPath
    ? path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath)
    : path.resolve(__dirname, '../../../../docs/templates/nexium.demo.json');

  const raw = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(raw) as DemoConfig;
}
