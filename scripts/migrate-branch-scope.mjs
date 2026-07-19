import fs from 'fs';
import path from 'path';

const root = path.resolve('apps/api/src/modules');

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, a);
    else if (e.name.endsWith('.service.ts')) a.push(p);
  }
  return a;
}

const files = walk(root);
let n = 0;

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const o = s;
  const needs =
    s.includes('branchId ? { branchId } : {}') ||
    s.includes("branchId ?? 'all'") ||
    s.includes('...(branchId ? { branchId }');

  if (!needs) continue;

  if (!s.includes('prismaBranchFilter')) {
    const fromModules = path.relative(path.dirname(f), path.resolve('apps/api/src/common/utils'));
    const rel = path.join(fromModules, 'branch-scope.util').replace(/\\/g, '/');
    const importPath = rel.startsWith('.') ? rel : `./${rel}`;
    s =
      `import { prismaBranchFilter, prismaBranchIdFilter, scopeCacheKey, requireSingleBranchId, sqlBranchFilter } from '${importPath}';\n` +
      `import type { BranchScope } from '@eims/shared';\n` +
      s;
  } else if (!s.includes('BranchScope')) {
    s = `import type { BranchScope } from '@eims/shared';\n` + s;
  }

  s = s.replace(
    /const branchFilter = branchId \? \{ branchId \} : \{\};/g,
    'const branchFilter = prismaBranchFilter(scope);',
  );
  s = s.replace(
    /\.\.\.\(branchId \? \{ branchId \} : \{\}\)/g,
    '...prismaBranchFilter(scope)',
  );
  s = s.replace(
    /branchId \? \{ id: branchId \} : \{\}/g,
    'prismaBranchIdFilter(scope)',
  );
  s = s.replace(
    /\.\.\.\(branchId \? \{ id: branchId \} : \{\}\)/g,
    '...prismaBranchIdFilter(scope)',
  );
  s = s.replace(/\$\{branchId \?\? 'all'\}/g, '${scopeCacheKey(scope)}');

  // Rename method parameters branchId: string | null -> scope: BranchScope
  // Avoid renaming CreateStudentInput fields etc. by only matching type annotations in signatures.
  s = s.replace(/(\(|,\s*)branchId: string \| null/g, '$1scope: BranchScope');

  if (s !== o) {
    fs.writeFileSync(f, s);
    n++;
    console.log('updated', path.relative(process.cwd(), f));
  }
}

console.log('services updated:', n);

// Controllers: swap @BranchId() branchId with @BranchScopeParam() scope
const controllers = walk(root).map((f) => f.replace(/\.service\.ts$/, '.controller.ts')).filter((f) => fs.existsSync(f));
// Also walk for controllers not paired
function walkCtrl(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkCtrl(p, a);
    else if (e.name.endsWith('.controller.ts')) a.push(p);
  }
  return a;
}

let c = 0;
for (const f of walkCtrl(root)) {
  let s = fs.readFileSync(f, 'utf8');
  const o = s;
  if (!s.includes('@BranchId()')) continue;

  if (!s.includes('BranchScopeParam')) {
    s = s.replace(
      /import \{([^}]+)\} from '(\.\.\/)+common\/decorators\/auth\.decorators';/,
      (m, names, dots) => {
        let n = names;
        if (!n.includes('BranchScopeParam')) {
          n = n.includes('BranchId')
            ? n.replace('BranchId', 'BranchId, BranchScopeParam')
            : `BranchScopeParam, ${n}`;
        }
        return `import {${n}} from '${dots}common/decorators/auth.decorators';`;
      },
    );
  }

  if (!s.includes('BranchScope')) {
    if (s.includes("from '@eims/shared'")) {
      s = s.replace(/from '@eims\/shared';/, (m) => {
        // ensure type import
        return m;
      });
      s = s.replace(
        /import (type )?\{([^}]+)\} from '@eims\/shared';/,
        (m, typ, names) => {
          if (names.includes('BranchScope')) return m;
          const prefix = typ ? 'type ' : '';
          // Prefer adding type BranchScope separately if import is value-only
          if (typ) return `import type {${names}, BranchScope} from '@eims/shared';`;
          return `import {${names}, type BranchScope} from '@eims/shared';`;
        },
      );
    } else {
      s = `import type { BranchScope } from '@eims/shared';\n` + s;
    }
  }

  s = s.replace(
    /@BranchId\(\)\s*branchId: string \| null/g,
    '@BranchScopeParam() scope: BranchScope',
  );

  // Update service calls that passed branchId as last/middle arg — only replace identifier branchId
  // when it's clearly the guard param. Heuristic: this.xxx(..., branchId) -> scope
  s = s.replace(/(\bthis\.\w+\.\w+\([^;]*?)\bbranchId\b/g, (m, prefix) => {
    // Don't replace body.branchId or query.branchId
    if (m.includes('body.') || m.includes('query.') || m.includes('user.branchId')) return m;
    return `${prefix}scope`;
  });

  // recent activities special case may still reference branchId variable
  s = s.replace(
    /const scopeBranchId = canReadAll \? null : branchId;/g,
    'const activityScope = canReadAll ? { kind: "all" as const } : scope;',
  );
  s = s.replace(
    /if \(!canReadAll && !scopeBranchId\)/g,
    'if (!canReadAll && scope.kind === "all")',
  );
  s = s.replace(
    /return this\.dashboardService\.getRecentActivities\(user, scopeBranchId\);/g,
    'return this.dashboardService.getRecentActivities(user, activityScope);',
  );

  if (s !== o) {
    fs.writeFileSync(f, s);
    c++;
    console.log('controller', path.relative(process.cwd(), f));
  }
}
console.log('controllers updated:', c);
