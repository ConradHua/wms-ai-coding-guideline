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
};

const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_EVENTS);

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

function buildConfig(selected, scriptDir = 'hooks/governance-audit', platform = 'copilot') {
  const features = validateFeatures(selected, platform);
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(scriptDir) || scriptDir.split('/').includes('..')) {
    throw new Error('expected a repository-relative script directory using forward slashes');
  }
  const events = PLATFORM_EVENTS[platform];
  const required = new Set([...features].flatMap(name => INVENTORY.features[name].requires));
  const hooks = {};
  const featureList = [...features].join(',');

  for (const [kind, event] of Object.entries(events)) {
    if (!required.has(kind)) continue;
    const promptEvent = kind === 'prompt' || kind === 'transformed';
    if (platform === 'cursor') {
      hooks[event] = [{
        command: `node ${scriptDir}/governance.cjs ${kind} --platform cursor --features ${featureList}`,
      }];
    } else {
      hooks[event] = [{
        type: 'command',
        command: `node ${scriptDir}/governance.cjs ${kind}`,
        cwd: '.',
        env: { GOVERNANCE_FEATURES: featureList },
        timeoutSec: promptEvent ? 10 : 5,
      }];
    }
  }
  return { version: 1, hooks };
}

function parseCliArgs(argv) {
  let platform = 'copilot';
  let scriptDir = 'hooks/governance-audit';
  const features = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--platform') {
      platform = argv[++i];
      if (!platform) throw new Error('missing value for --platform');
    } else if (arg === '--script-dir') {
      scriptDir = argv[++i];
      if (!scriptDir) throw new Error('missing value for --script-dir');
    } else {
      features.push(arg);
    }
  }
  return { platform, scriptDir, features };
}

if (require.main === module) {
  try {
    const { platform, scriptDir, features } = parseCliArgs(process.argv.slice(2));
    process.stdout.write(JSON.stringify(buildConfig(features, scriptDir, platform), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`Governance configuration: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { INVENTORY, SUPPORTED_PLATFORMS, PLATFORM_EVENTS, parseFeatures, buildConfig };
