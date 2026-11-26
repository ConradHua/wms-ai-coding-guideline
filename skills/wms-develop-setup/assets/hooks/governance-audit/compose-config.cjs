'use strict';

const INVENTORY = require('./feature-map.json');

const PLATFORM_EVENTS = {
  copilot: {
    'session-start': 'sessionStart',
    prompt: 'userPromptSubmitted',
    transformed: 'userPromptTransformed',
    'pre-tool': 'preToolUse',
    'post-tool': 'postToolUse',
    'tool-failure': 'postToolUseFailure',
    'turn-end': 'agentStop',
    'session-end': 'sessionEnd',
  },
  cursor: {
    'session-start': 'sessionStart',
    prompt: 'beforeSubmitPrompt',
    'pre-tool': 'preToolUse',
    'post-tool': 'postToolUse',
    'tool-failure': 'postToolUseFailure',
    'turn-end': 'stop',
    'session-end': 'sessionEnd',
  },
  codex: {
    'session-start': 'SessionStart',
    prompt: 'UserPromptSubmit',
    'pre-tool': 'PreToolUse',
    'post-tool': 'PostToolUse',
    'turn-end': 'Stop',
    'session-end': 'SessionEnd',
  },
};

const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_EVENTS);
const LICENSE_MODES = new Set(['warn', 'block']);

function validatePlatform(platform) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`unsupported hook platform "${platform}". Expected one of: ${SUPPORTED_PLATFORMS.join(', ')}`);
  }
  return platform;
}

function validateFeatures(names, platform = 'copilot') {
  validatePlatform(platform);
  if (names.some(name => !Object.hasOwn(INVENTORY.features, name)) || new Set(names).size !== names.length) {
    throw new Error('unknown or duplicate governance feature');
  }
  for (const name of names) {
    const allowed = INVENTORY.features[name].platforms ?? SUPPORTED_PLATFORMS;
    if (!allowed.includes(platform)) {
      throw new Error(`governance feature "${name}" is not supported on platform "${platform}"`);
    }
  }
  return new Set(names);
}

function parseFeatures(raw, platform = 'copilot') {
  if (raw === undefined) {
    const defaults = Object.entries(INVENTORY.features)
      .filter(([, meta]) => (meta.platforms ?? SUPPORTED_PLATFORMS).includes(platform))
      .map(([name]) => name);
    return validateFeatures(defaults, platform);
  }
  return validateFeatures(raw.split(',').map(name => name.trim()).filter(Boolean), platform);
}

function normalizeLicenseMode(mode, features) {
  const selected = mode ?? 'warn';
  if (!LICENSE_MODES.has(selected)) {
    throw new Error('invalid license mode; expected warn or block');
  }
  if (!features.has('license-check')) return selected;
  return selected;
}

function buildConfig(selected, scriptDir = 'hooks/governance-audit', platform = 'copilot', licenseMode = 'warn') {
  const features = validateFeatures(selected, platform);
  const mode = normalizeLicenseMode(licenseMode, features);
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(scriptDir) || scriptDir.split('/').includes('..')) {
    throw new Error('expected a repository-relative script directory using forward slashes');
  }
  const events = PLATFORM_EVENTS[platform];
  const required = new Set([...features].flatMap(name => INVENTORY.features[name].requires));
  const hooks = {};
  const featureList = [...features].join(',');
  const licenseSelected = features.has('license-check');

  for (const [kind, event] of Object.entries(events)) {
    if (!required.has(kind)) continue;
    const promptEvent = kind === 'prompt' || kind === 'transformed';
    let timeout = promptEvent ? 10 : 5;
    if (licenseSelected && kind === 'turn-end') timeout = 60;
    if (platform === 'copilot') {
      const env = { GOVERNANCE_FEATURES: featureList };
      if (licenseSelected) env.LICENSE_MODE = mode;
      hooks[event] = [{
        type: 'command',
        command: `node ${scriptDir}/governance.cjs ${kind}`,
        cwd: '.',
        env,
        timeoutSec: timeout,
      }];
      continue;
    }

    let command = `node ${scriptDir}/governance.cjs ${kind} --platform ${platform} --features ${featureList}`;
    if (licenseSelected) command += ` --license-mode ${mode}`;
    if (platform === 'cursor') {
      hooks[event] = [{ command }];
      continue;
    }

    hooks[event] = [{ hooks: [{
      type: 'command',
      command: `cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && ${command}`,
      commandWindows: `$repoUp = git rev-parse --show-cdup 2>$null; if ($repoUp) { Set-Location -LiteralPath $repoUp -ErrorAction Stop }; ${command}; exit $LASTEXITCODE`,
      timeout: kind === 'session-end' ? 3 : timeout,
    }] }];
  }
  return platform === 'codex' ? { hooks } : { version: 1, hooks };
}

function parseCliArgs(argv) {
  let platform = 'copilot';
  let scriptDir = 'hooks/governance-audit';
  let licenseMode = 'warn';
  const features = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--platform') {
      platform = argv[++i];
      if (!platform) throw new Error('missing value for --platform');
    } else if (arg === '--script-dir') {
      scriptDir = argv[++i];
      if (!scriptDir) throw new Error('missing value for --script-dir');
    } else if (arg === '--license-mode') {
      licenseMode = argv[++i];
      if (!licenseMode) throw new Error('missing value for --license-mode');
    } else {
      features.push(arg);
    }
  }
  return { platform, scriptDir, features, licenseMode };
}

if (require.main === module) {
  try {
    const { platform, scriptDir, features, licenseMode } = parseCliArgs(process.argv.slice(2));
    process.stdout.write(JSON.stringify(buildConfig(features, scriptDir, platform, licenseMode), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`Governance configuration: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { INVENTORY, SUPPORTED_PLATFORMS, PLATFORM_EVENTS, parseFeatures, buildConfig };
