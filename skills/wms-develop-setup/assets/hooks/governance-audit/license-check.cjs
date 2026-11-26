'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const DEFAULT_BLOCKED = [
  'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later',
  'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'AGPL-1.0', 'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
  'LGPL-2.0', 'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'SSPL-1.0', 'EUPL-1.1', 'EUPL-1.2', 'OSL-3.0', 'CPAL-1.0', 'CPL-1.0',
  'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0',
];

const PACKAGE_JSON_META_KEYS = new Set([
  'name', 'version', 'description', 'main', 'scripts',
  'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies',
]);

const CARGO_META_KEYS = new Set([
  'name', 'version', 'edition', 'authors', 'description',
  'license', 'repository', 'rust-version',
]);

function parseCsvList(raw) {
  if (!raw) return [];
  return raw.split(',').map(entry => entry.trim()).filter(Boolean);
}

function isAllowlisted(pkg, allowlist) {
  return allowlist.includes(pkg);
}

function isBlockedLicense(license, blocked) {
  const licenseLower = String(license).toLowerCase();
  return blocked.some(entry => licenseLower.includes(entry.toLowerCase()));
}

function gitDiffLines(file) {
  try {
    const output = execFileSync('git', ['diff', 'HEAD', '--', file], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output.split(/\r?\n/u).filter(line => line.startsWith('+') && !line.startsWith('+++'));
  } catch {
    return [];
  }
}

function detectNewDependencies() {
  const deps = [];

  for (const line of gitDiffLines('package.json')) {
    const match = line.match(/^\+\s*"([^"]+)"\s*:\s*"[^"]*"/u);
    if (!match) continue;
    const pkg = match[1];
    if (!PACKAGE_JSON_META_KEYS.has(pkg)) deps.push({ ecosystem: 'npm', package: pkg });
  }

  for (const line of gitDiffLines('requirements.txt')) {
    const clean = line.slice(1).trim();
    if (!clean || clean.startsWith('#')) continue;
    const pkg = clean.split(/[><=!~\s]/u)[0];
    if (pkg) deps.push({ ecosystem: 'pip', package: pkg });
  }

  for (const line of gitDiffLines('pyproject.toml')) {
    const match = line.match(/^\+\s*"([A-Za-z0-9_-]+)/u);
    if (match) deps.push({ ecosystem: 'pip', package: match[1] });
  }

  for (const line of gitDiffLines('go.mod')) {
    const match = line.match(/^\+\s*([a-zA-Z0-9._/-]*\.[a-zA-Z0-9._/-]*)\s/u);
    if (!match) continue;
    const pkg = match[1];
    if (!['module', 'go', 'require'].includes(pkg)) deps.push({ ecosystem: 'go', package: pkg });
  }

  for (const line of gitDiffLines('Gemfile')) {
    const match = line.match(/^\+\s*gem\s*['"`]([^'"`]+)['"`]/u);
    if (match) deps.push({ ecosystem: 'ruby', package: match[1] });
  }

  for (const line of gitDiffLines('Cargo.toml')) {
    const match = line.match(/^\+\s*([a-zA-Z0-9_-]+)\s*=/u);
    if (!match) continue;
    const pkg = match[1];
    if (!CARGO_META_KEYS.has(pkg)) deps.push({ ecosystem: 'rust', package: pkg });
  }

  return deps;
}

function runTimed(command, args, timeoutMs = 5000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) return null;
  return (result.stdout ?? '').trim();
}

function readNpmLicense(pkg) {
  const pkgJsonPath = path.join('node_modules', ...pkg.split('/'), 'package.json');
  try {
    const data = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (typeof data.license === 'string' && data.license.trim()) return data.license.trim();
    if (data.license && typeof data.license === 'object' && typeof data.license.type === 'string') {
      return data.license.type.trim() || 'UNKNOWN';
    }
  } catch { /* fall through to npm view */ }
  const viewed = runTimed('npm', ['view', pkg, 'license']);
  return viewed || 'UNKNOWN';
}

function readPipLicense(pkg) {
  for (const bin of ['pip', 'pip3']) {
    const output = runTimed(bin, ['show', pkg]);
    if (!output) continue;
    const match = output.match(/^License:\s*(.+)$/imu);
    if (match) return match[1].trim() || 'UNKNOWN';
  }
  return 'UNKNOWN';
}

function classifyGoLicenseText(text) {
  const lower = text.toLowerCase();
  if (/gnu general public license/iu.test(text)) {
    if (/version 3/iu.test(text)) return 'GPL-3.0';
    if (/version 2/iu.test(text)) return 'GPL-2.0';
    return 'GPL';
  }
  if (/gnu lesser general public/iu.test(text)) return 'LGPL';
  if (/gnu affero general public/iu.test(text)) return 'AGPL-3.0';
  if (/mit license/iu.test(lower)) return 'MIT';
  if (/apache license/iu.test(lower)) return 'Apache-2.0';
  if (/\bbsd\b/iu.test(lower)) return 'BSD';
  return 'UNKNOWN';
}

function readGoLicense(pkg) {
  const gopath = process.env.GOPATH || path.join(osHomedir(), 'go');
  const modRoot = path.join(gopath, 'pkg', 'mod');
  if (!fs.existsSync(modRoot)) return 'UNKNOWN';
  const needle = `${pkg}@`;
  let foundDir = null;
  const stack = [modRoot];
  let depthGuard = 0;
  while (stack.length && depthGuard < 5000) {
    depthGuard += 1;
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (full.includes(needle) || entry.name.includes(needle.replace(/\//gu, path.sep))) {
        foundDir = full;
        break;
      }
      const relativeDepth = full.slice(modRoot.length).split(path.sep).filter(Boolean).length;
      if (relativeDepth < 4) stack.push(full);
    }
    if (foundDir) break;
  }
  if (!foundDir) return 'UNKNOWN';
  let licenseFile = null;
  try {
    for (const entry of fs.readdirSync(foundDir)) {
      if (/^LICENSE/iu.test(entry)) {
        const full = path.join(foundDir, entry);
        if (fs.statSync(full).isFile()) {
          licenseFile = full;
          break;
        }
      }
    }
  } catch { return 'UNKNOWN'; }
  if (!licenseFile) return 'UNKNOWN';
  try {
    return classifyGoLicenseText(fs.readFileSync(licenseFile, 'utf8'));
  } catch {
    return 'UNKNOWN';
  }
}

function osHomedir() {
  return require('node:os').homedir();
}

function readRubyLicense(pkg) {
  const output = runTimed('gem', ['spec', pkg, 'license']);
  if (!output) return 'UNKNOWN';
  const line = output.split(/\r?\n/u).find(entry => entry && !entry.startsWith('---') && !entry.startsWith('...'));
  if (!line) return 'UNKNOWN';
  return line.replace(/^- /, '').trim() || 'UNKNOWN';
}

function readRustLicense(pkg) {
  const output = runTimed('cargo', ['metadata', '--format-version', '1'], 10000);
  if (!output) return 'UNKNOWN';
  try {
    const metadata = JSON.parse(output);
    const match = (metadata.packages || []).find(entry => entry.name === pkg);
    if (match && typeof match.license === 'string' && match.license.trim()) return match.license.trim();
  } catch { /* ignore */ }
  return 'UNKNOWN';
}

function getLicense(ecosystem, pkg) {
  let license = 'UNKNOWN';
  switch (ecosystem) {
    case 'npm':
      license = readNpmLicense(pkg);
      break;
    case 'pip':
      license = readPipLicense(pkg);
      break;
    case 'go':
      license = readGoLicense(pkg);
      break;
    case 'ruby':
      license = readRubyLicense(pkg);
      break;
    case 'rust':
      license = readRustLicense(pkg);
      break;
    default:
      license = 'UNKNOWN';
  }
  license = String(license ?? '').trim();
  return license || 'UNKNOWN';
}

function isInsideGitRepo() {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf8',
      timeout: 2000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan newly added dependencies for blocked licenses.
 * @param {{ mode?: 'warn'|'block' }} [options]
 * @returns {{ checked: number, violations: Array<object>, results: Array<object>, skipped?: boolean, mode: string }}
 */
function checkLicenses(options = {}) {
  const mode = options.mode === 'block' ? 'block' : 'warn';

  if (process.env.SKIP_LICENSE_CHECK === 'true') {
    return { checked: 0, violations: [], results: [], skipped: true, mode };
  }

  if (!isInsideGitRepo()) {
    return { checked: 0, violations: [], results: [], skipped: true, mode };
  }

  const blocked = parseCsvList(process.env.BLOCKED_LICENSES);
  const blockedList = blocked.length ? blocked : DEFAULT_BLOCKED;
  const allowlist = parseCsvList(process.env.LICENSE_ALLOWLIST);

  const deps = detectNewDependencies();
  const results = deps.map(({ ecosystem, package: pkg }) => {
    const license = getLicense(ecosystem, pkg);
    let status = 'OK';
    if (allowlist.length && isAllowlisted(pkg, allowlist)) status = 'ALLOWLISTED';
    else if (isBlockedLicense(license, blockedList)) status = 'BLOCKED';
    return { ecosystem, package: pkg, license, status };
  });

  const violations = results
    .filter(entry => entry.status === 'BLOCKED')
    .map(entry => ({
      package: entry.package,
      ecosystem: entry.ecosystem,
      license: entry.license,
      status: entry.status,
    }));

  return { checked: results.length, violations, results, mode };
}

function formatSummary(result, { showModeHint = true } = {}) {
  if (result.skipped) return 'License check skipped.';
  if (result.checked === 0) return 'No new dependencies detected.';
  const lines = [
    `Checked ${result.checked} new dependenc${result.checked === 1 ? 'y' : 'ies'} (mode=${result.mode}):`,
  ];
  for (const entry of result.results) {
    lines.push(`  ${entry.package} (${entry.ecosystem}): ${entry.license} [${entry.status}]`);
  }
  if (result.violations.length) {
    lines.push(`Found ${result.violations.length} license violation(s).`);
    if (showModeHint) {
      if (result.mode === 'block') {
        lines.push('Blocked: resolve license violations before committing.');
      } else {
        lines.push('Warn-only: set LICENSE_MODE=block to fail the hook on violations.');
      }
    }
  } else {
    lines.push('All checked dependencies have compliant licenses.');
  }
  return lines.join('\n');
}

module.exports = {
  checkLicenses,
  formatSummary,
  DEFAULT_BLOCKED,
  detectNewDependencies,
  isBlockedLicense,
};
