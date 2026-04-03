/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  getErrorMessage,
  type Config,
  type ProviderModelConfig as ModelConfig,
} from '@ceroclaw/core';
import { writeStdoutLine, writeStderrLine } from '../../utils/stdioHelpers.js';
import { t } from '../../i18n/index.js';
import {
  getCodingPlanConfig,
  isCodingPlanConfig,
  CodingPlanRegion,
  CODING_PLAN_ENV_KEY,
} from '../../constants/codingPlan.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import { backupSettingsFile } from '../../utils/settingsUtils.js';
import { loadSettings, loadEnvironment, type LoadedSettings } from '../../config/settings.js';
import { loadCliConfig } from '../../config/config.js';
import type { CliArgs } from '../../config/config.js';
import { InteractiveSelector } from './interactiveSelector.js';

// OpenAI constants
const OPENAI_ENV_KEY = 'OPENAI_API_KEY';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const OPENAI_MODELS: ModelConfig[] = [
  { id: 'gpt-5.4', name: 'GPT-5.4 (flagship)', envKey: OPENAI_ENV_KEY, baseUrl: OPENAI_BASE_URL },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini (fast)', envKey: OPENAI_ENV_KEY, baseUrl: OPENAI_BASE_URL },
  { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex (agentic coding)', envKey: OPENAI_ENV_KEY, baseUrl: OPENAI_BASE_URL },
  { id: 'gpt-4o', name: 'GPT-4o', envKey: OPENAI_ENV_KEY, baseUrl: OPENAI_BASE_URL },
];

// GLM / Z.AI constants
const GLM_ENV_KEY = 'ZAI_API_KEY';
const GLM_BASE_URL = 'https://api.z.ai/api/anthropic';
const GLM_MODELS: ModelConfig[] = [
  { id: 'glm-5.1', name: 'GLM-5.1 (Z.AI)', envKey: GLM_ENV_KEY, baseUrl: GLM_BASE_URL },
  { id: 'glm-4.7', name: 'GLM-4.7 (Z.AI)', envKey: GLM_ENV_KEY, baseUrl: GLM_BASE_URL },
  { id: 'glm-4.6', name: 'GLM-4.6 (Z.AI)', envKey: GLM_ENV_KEY, baseUrl: GLM_BASE_URL },
];

interface CeroclawdAuthOptions {
  region?: string;
  key?: string;
}

interface CodingPlanSettings {
  region?: CodingPlanRegion;
  version?: string;
}

interface MergedSettingsWithCodingPlan {
  security?: {
    auth?: {
      selectedType?: string;
    };
  };
  codingPlan?: CodingPlanSettings;
  model?: {
    name?: string;
  };
  modelProviders?: Record<string, ModelConfig[]>;
  env?: Record<string, string>;
}

/**
 * Handles the authentication process based on the specified command and options
 */
export async function handleCeroclawdAuth(
  command: 'ceroclawd-oauth' | 'coding-plan',
  options: CeroclawdAuthOptions,
) {
  try {
    const settings = loadSettings();

    // Create a minimal argv for config loading
    const minimalArgv: CliArgs = {
      query: undefined,
      model: undefined,
      sandbox: undefined,
      sandboxImage: undefined,
      debug: undefined,
      prompt: undefined,
      promptInteractive: undefined,
      yolo: undefined,
      approvalMode: undefined,
      telemetry: undefined,
      checkpointing: undefined,
      telemetryTarget: undefined,
      telemetryOtlpEndpoint: undefined,
      telemetryOtlpProtocol: undefined,
      telemetryLogPrompts: undefined,
      telemetryOutfile: undefined,
      allowedMcpServerNames: undefined,
      allowedTools: undefined,
      acp: undefined,
      experimentalAcp: undefined,
      experimentalLsp: undefined,
      experimentalHooks: undefined,
      extensions: [],
      listExtensions: undefined,
      openaiLogging: undefined,
      openaiApiKey: undefined,
      openaiBaseUrl: undefined,
      openaiLoggingDir: undefined,
      proxy: undefined,
      includeDirectories: undefined,
      tavilyApiKey: undefined,
      googleApiKey: undefined,
      googleSearchEngineId: undefined,
      webSearchDefault: undefined,
      screenReader: undefined,
      inputFormat: undefined,
      outputFormat: undefined,
      includePartialMessages: undefined,
      chatRecording: undefined,
      continue: undefined,
      resume: undefined,
      sessionId: undefined,
      maxSessionTurns: undefined,
      coreTools: undefined,
      excludeTools: undefined,
      authType: undefined,
      channel: undefined,
      systemPrompt: undefined,
      appendSystemPrompt: undefined,
    };

    // Create a minimal config to access settings and storage
    const config = await loadCliConfig(
      settings.merged,
      minimalArgv,
      process.cwd(),
      [], // No extensions for auth command
    );

    if (command === 'ceroclawd-oauth') {
      await handleCeroclawdOAuth(config, settings);
    } else if (command === 'coding-plan') {
      await handleCodePlanAuth(config, settings, options);
    }

    // Exit after authentication is complete
    writeStdoutLine(t('Authentication completed successfully.'));
    process.exit(0);
  } catch (error) {
    writeStderrLine(getErrorMessage(error));
    process.exit(1);
  }
}

/**
 * Handles Ceroclawd OAuth authentication
 */
async function handleCeroclawdOAuth(
  config: Config,
  settings: LoadedSettings,
): Promise<void> {
  writeStdoutLine(t('Starting Ceroclawd OAuth authentication...'));

  try {
    await config.refreshAuth(AuthType.CEROCLAW_OAUTH);

    // Persist the auth type
    const authTypeScope = getPersistScopeForModelSelection(settings);
    settings.setValue(
      authTypeScope,
      'security.auth.selectedType',
      AuthType.CEROCLAW_OAUTH,
    );

    writeStdoutLine(t('Successfully authenticated with Ceroclawd OAuth.'));
    process.exit(0);
  } catch (error) {
    writeStderrLine(
      t('Failed to authenticate with Ceroclawd OAuth: {{error}}', {
        error: getErrorMessage(error),
      }),
    );
    process.exit(1);
  }
}

/**
 * Handles Alibaba Cloud Coding Plan authentication
 */
async function handleCodePlanAuth(
  config: Config,
  settings: LoadedSettings,
  options: CeroclawdAuthOptions,
): Promise<void> {
  const { region, key } = options;

  let selectedRegion: CodingPlanRegion;
  let selectedKey: string;

  // If region and key are provided as options, use them
  if (region && key) {
    selectedRegion =
      region.toLowerCase() === 'global'
        ? CodingPlanRegion.GLOBAL
        : CodingPlanRegion.CHINA;
    selectedKey = key;
  } else {
    // Otherwise, prompt interactively
    selectedRegion = await promptForRegion();
    selectedKey = await promptForKey(t('Enter your Coding Plan API key: '));
  }

  writeStdoutLine(t('Processing Alibaba Cloud Coding Plan authentication...'));

  try {
    // Get configuration based on region
    const { template, version } = getCodingPlanConfig(selectedRegion);

    // Get persist scope
    const authTypeScope = getPersistScopeForModelSelection(settings);

    // Backup settings file before modification
    const settingsFile = settings.forScope(authTypeScope);
    backupSettingsFile(settingsFile.path);

    // Store api-key in settings.env (unified env key)
    settings.setValue(authTypeScope, `env.${CODING_PLAN_ENV_KEY}`, selectedKey);

    // Sync to process.env immediately so refreshAuth can read the apiKey
    process.env[CODING_PLAN_ENV_KEY] = selectedKey;

    // Generate model configs from template
    const newConfigs = template.map((templateConfig) => ({
      ...templateConfig,
      envKey: CODING_PLAN_ENV_KEY,
    }));

    // Get existing configs
    const existingConfigs =
      (settings.merged.modelProviders as Record<string, ModelConfig[]>)?.[
        AuthType.USE_OPENAI
      ] || [];

    // Filter out all existing Coding Plan configs (mutually exclusive)
    const nonCodingPlanConfigs = existingConfigs.filter(
      (existing) => !isCodingPlanConfig(existing.baseUrl, existing.envKey),
    );

    // Add new Coding Plan configs at the beginning
    const updatedConfigs = [...newConfigs, ...nonCodingPlanConfigs];

    // Persist to modelProviders
    settings.setValue(
      authTypeScope,
      `modelProviders.${AuthType.USE_OPENAI}`,
      updatedConfigs,
    );

    // Also persist authType
    settings.setValue(
      authTypeScope,
      'security.auth.selectedType',
      AuthType.USE_OPENAI,
    );

    // Persist coding plan region
    settings.setValue(authTypeScope, 'codingPlan.region', selectedRegion);

    // Persist coding plan version (single field for backward compatibility)
    settings.setValue(authTypeScope, 'codingPlan.version', version);

    // If there are configs, use the first one as the model
    if (updatedConfigs.length > 0 && updatedConfigs[0]?.id) {
      settings.setValue(
        authTypeScope,
        'model.name',
        (updatedConfigs[0] as ModelConfig).id,
      );
    }

    // Refresh auth with the new configuration
    await config.refreshAuth(AuthType.USE_OPENAI);

    writeStdoutLine(
      t('Successfully authenticated with Alibaba Cloud Coding Plan.'),
    );
  } catch (error) {
    writeStderrLine(
      t('Failed to authenticate with Coding Plan: {{error}}', {
        error: getErrorMessage(error),
      }),
    );
    process.exit(1);
  }
}

/**
 * Prompts the user to select a region using an interactive selector
 */
async function promptForRegion(): Promise<CodingPlanRegion> {
  const selector = new InteractiveSelector(
    [
      {
        value: CodingPlanRegion.CHINA,
        label: t('China'),
        description: t('aliyun.com'),
      },
      {
        value: CodingPlanRegion.GLOBAL,
        label: t('Global'),
        description: t('Alibaba Cloud (alibabacloud.com)'),
      },
    ],
    t('Select region for Coding Plan:'),
  );

  return await selector.select();
}

/**
 * Prompts the user to enter an API key (masked input)
 */
async function promptForKey(prompt: string): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  stdout.write(prompt);

  const wasRaw = stdin.isRaw;
  if (stdin.setRawMode) {
    stdin.setRawMode(true);
  }
  stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let input = '';

    const onData = (chunk: string) => {
      for (const char of chunk) {
        switch (char) {
          case '\r':
          case '\n':
            stdin.removeListener('data', onData);
            if (stdin.setRawMode) {
              stdin.setRawMode(wasRaw);
            }
            stdout.write('\n');
            resolve(input);
            return;
          case '\x03': // Ctrl+C
            stdin.removeListener('data', onData);
            if (stdin.setRawMode) {
              stdin.setRawMode(wasRaw);
            }
            stdout.write('^C\n');
            reject(new Error('Interrupted'));
            return;
          case '\x08':
          case '\x7F':
            if (input.length > 0) {
              input = input.slice(0, -1);
              stdout.write('\x1B[D \x1B[D');
            }
            break;
          default:
            input += char;
            stdout.write('*');
            break;
        }
      }
    };

    stdin.on('data', onData);
  });
}

// ChatGPT OAuth constants
const CHATGPT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CHATGPT_AUTH_URL = 'https://auth.openai.com/oauth/authorize';
const CHATGPT_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CHATGPT_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const CHATGPT_SCOPE = 'openid profile email offline_access';
const CHATGPT_MODELS = [
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
];

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process');
  const platform = process.platform;
  const cmd =
    platform === 'win32' ? `start "" "${url}"` :
    platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd);
}

async function startCallbackServer(port: number): Promise<{ code: string; state: string }> {
  const http = await import('node:http');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url ?? '/', `http://localhost:${port}`);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const error = urlObj.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h2>${error ? 'Authentication failed: ' + error : 'Authentication successful!'}</h2><p>You can close this tab.</p></body></html>`);
      server.close();

      if (error || !code || !state) {
        reject(new Error(error ?? 'Missing code or state in callback'));
      } else {
        resolve({ code, state });
      }
    });

    server.listen(port, () => {
      // server ready
    });

    server.on('error', reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out. Please try again.'));
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const https = await import('node:https');
  const body = JSON.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: CHATGPT_REDIRECT_URI,
    client_id: CHATGPT_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(CHATGPT_TOKEN_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
            error?: string;
          };
          if (!parsed.access_token) {
            reject(new Error(`Token exchange failed: ${parsed.error ?? data}`));
            return;
          }
          resolve({
            accessToken: parsed.access_token,
            refreshToken: parsed.refresh_token ?? '',
            expiresIn: parsed.expires_in ?? 3600,
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Handles ChatGPT Plus/Pro OAuth authentication (uses subscription, no API credits)
 */
export async function handleChatGPTAuth(settings: LoadedSettings): Promise<void> {
  const cryptoMod = await import('node:crypto');
  const pathMod = await import('node:path');
  const fsMod = await import('node:fs');
  const osMod = await import('node:os');

  // Generate PKCE
  const codeVerifier = cryptoMod.randomBytes(32).toString('base64url');
  const codeChallenge = cryptoMod.createHash('sha256').update(codeVerifier).digest().toString('base64url');
  const state = cryptoMod.randomBytes(16).toString('hex');

  // Build authorization URL
  const authUrl = new URL(CHATGPT_AUTH_URL);
  authUrl.searchParams.set('client_id', CHATGPT_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', CHATGPT_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', CHATGPT_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  writeStdoutLine(t('\nOpening browser for ChatGPT authentication...'));
  writeStdoutLine(t('If the browser does not open, visit this URL manually:\n'));
  writeStdoutLine(authUrl.toString());
  writeStdoutLine(t('\nWaiting for authentication (5 min timeout)...\n'));

  // Open browser
  await openBrowser(authUrl.toString());

  // Wait for callback
  const { code, state: returnedState } = await startCallbackServer(1455);

  if (returnedState !== state) {
    throw new Error('State mismatch — possible CSRF attack. Please try again.');
  }

  writeStdoutLine(t('Authorization code received. Exchanging for tokens...'));

  const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(code, codeVerifier);

  // Decode account ID from JWT
  const parts = accessToken.split('.');
  let accountId = '';
  if (parts.length >= 2) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8')) as { sub?: string };
      accountId = payload.sub ?? '';
    } catch { /* ignore */ }
  }

  // Save tokens
  const tokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    accountId,
  };
  const tokensPath = pathMod.join(osMod.homedir(), '.ceroclawd', 'chatgpt-tokens.json');
  fsMod.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');

  // Update settings
  const scope = getPersistScopeForModelSelection(settings);
  settings.setValue(scope, 'security.auth.selectedType', AuthType.USE_CHATGPT_OAUTH);
  settings.setValue(scope, 'model.name', 'gpt-5.4');

  const chatgptModels = CHATGPT_MODELS.map(id => ({
    id,
    name: id,
    baseUrl: 'https://api.openai.com/v1/codex',
  }));
  settings.setValue(scope, `modelProviders.${AuthType.USE_CHATGPT_OAUTH}`, chatgptModels);

  writeStdoutLine(t('\nChatGPT authenticated successfully!'));
  writeStdoutLine(t('Account ID: {{id}}', { id: accountId || 'unknown' }));
  writeStdoutLine(t('Active model: gpt-5.4'));
  writeStdoutLine(t('Available: gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.2-codex'));
  writeStdoutLine(t('Tokens saved to ~/.ceroclawd/chatgpt-tokens.json'));
}

/**
 * Handles OpenAI (GPT-4o, GPT-4.1, Codex) authentication via API key
 */
export async function handleOpenAIAuth(
  settings: LoadedSettings,
  key?: string,
): Promise<void> {
  const resolvedKey = key ?? (await promptForKey(t('Enter your OpenAI API key: ')));

  writeStdoutLine(t('Configuring OpenAI...'));

  const scope = getPersistScopeForModelSelection(settings);

  settings.setValue(scope, `env.${OPENAI_ENV_KEY}`, resolvedKey);
  process.env[OPENAI_ENV_KEY] = resolvedKey;

  settings.setValue(scope, `modelProviders.${AuthType.USE_OPENAI}`, OPENAI_MODELS);
  settings.setValue(scope, 'security.auth.selectedType', AuthType.USE_OPENAI);
  settings.setValue(scope, 'model.name', 'gpt-5.4');

  writeStdoutLine(t('OpenAI configured. Active model: gpt-5.4.'));
  writeStdoutLine(t('Available models: GPT-5.4, GPT-5.4 Mini, GPT-5.3-Codex, GPT-4o.'));
  writeStdoutLine(t('Switch models with: ceroclawd --model <model-id>'));
}

/**
 * Handles GLM / Z.AI (via Anthropic proxy) authentication via API key
 */
export async function handleGLMAuth(
  settings: LoadedSettings,
  key?: string,
): Promise<void> {
  const resolvedKey = key ?? (await promptForKey(t('Enter your Z.AI API key: ')));

  writeStdoutLine(t('Configuring GLM / Z.AI...'));

  const scope = getPersistScopeForModelSelection(settings);

  // Save under both names for compatibility
  settings.setValue(scope, `env.${GLM_ENV_KEY}`, resolvedKey);
  settings.setValue(scope, 'env.ANTHROPIC_API_KEY', resolvedKey);
  settings.setValue(scope, 'env.ANTHROPIC_BASE_URL', GLM_BASE_URL);
  process.env[GLM_ENV_KEY] = resolvedKey;
  process.env['ANTHROPIC_API_KEY'] = resolvedKey;
  process.env['ANTHROPIC_BASE_URL'] = GLM_BASE_URL;

  settings.setValue(scope, `modelProviders.${AuthType.USE_ANTHROPIC}`, GLM_MODELS);
  settings.setValue(scope, 'security.auth.selectedType', AuthType.USE_ANTHROPIC);
  settings.setValue(scope, 'model.name', 'glm-5.1');

  writeStdoutLine(t('GLM / Z.AI configured. Active model: glm-5.1.'));
  writeStdoutLine(t('Available models: GLM-5.1, GLM-4.7, GLM-4.6.'));
  writeStdoutLine(t('Switch models with: ceroclawd --model <model-id>'));
}

/**
 * Runs the interactive authentication flow
 */
export async function runInteractiveAuth() {
  const settings = loadSettings();
  loadEnvironment(settings.merged);

  const currentType = (settings.merged as MergedSettingsWithCodingPlan).security?.auth?.selectedType ?? '';
  const currentModel = (settings.merged as MergedSettingsWithCodingPlan).model?.name ?? '';

  const mark = (type: string) => (currentType === type ? ' [active]' : '');

  const hasGLM = !!(process.env['ZAI_API_KEY'] || process.env['ANTHROPIC_API_KEY']);
  const hasOpenAI = !!process.env[OPENAI_ENV_KEY];

  const { existsSync } = await import('node:fs');
  const { join: pathJoin } = await import('node:path');
  const { homedir: homedirFn } = await import('node:os');
  const hasChatGPT = existsSync(pathJoin(homedirFn(), '.ceroclawd', 'chatgpt-tokens.json'));

  const glmStatus = hasGLM
    ? `${currentType === AuthType.USE_ANTHROPIC ? currentModel || 'glm-5.1' : 'glm-5.1'}${mark(AuthType.USE_ANTHROPIC)}`
    : 'not configured';
  const openaiStatus = hasOpenAI
    ? `${currentType === AuthType.USE_OPENAI ? currentModel || 'gpt-5.4' : 'gpt-5.4'}${mark(AuthType.USE_OPENAI)}`
    : 'not configured';
  const chatgptStatus = hasChatGPT
    ? `${currentType === AuthType.USE_CHATGPT_OAUTH ? currentModel || 'gpt-5.4' : 'gpt-5.4'}${mark(AuthType.USE_CHATGPT_OAUTH)}`
    : 'not configured';

  const selector = new InteractiveSelector(
    [
      {
        value: 'chatgpt' as const,
        label: t('ChatGPT Plus/Pro (OAuth - uses subscription)'),
        description: t('gpt-5.4, gpt-5.3-codex - no API credits needed - {{s}}', { s: chatgptStatus }),
      },
      {
        value: 'glm' as const,
        label: t('GLM / Z.AI'),
        description: t('GLM-5.1, GLM-4.7 via api.z.ai - {{s}}', { s: glmStatus }),
      },
      {
        value: 'openai' as const,
        label: t('OpenAI API key (pay per token)'),
        description: t('GPT-5.4, GPT-5.4 Mini, GPT-5.3-Codex - {{s}}', { s: openaiStatus }),
      },
      {
        value: 'ceroclawd-oauth' as const,
        label: t('Ceroclawd OAuth'),
        description: t('Free - Up to 1,000 req/day{{m}}', { m: mark(AuthType.CEROCLAW_OAUTH) }),
      },
      {
        value: 'coding-plan' as const,
        label: t('Alibaba Cloud Coding Plan'),
        description: t('Paid - Up to 6,000 req/5 hrs - All Qwen models'),
      },
    ],
    t('Select authentication method:'),
  );

  const choice = await selector.select();

  if (choice === 'chatgpt') {
    await handleChatGPTAuth(settings);
    process.exit(0);
  } else if (choice === 'glm') {
    if (hasGLM) {
      const scope = getPersistScopeForModelSelection(settings);
      settings.setValue(scope, 'security.auth.selectedType', AuthType.USE_ANTHROPIC);
      settings.setValue(scope, 'model.name', 'glm-5.1');
      writeStdoutLine(t('Switched to GLM / Z.AI (glm-5.1).'));
      process.exit(0);
    } else {
      await handleGLMAuth(settings);
      process.exit(0);
    }
  } else if (choice === 'openai') {
    if (hasOpenAI) {
      const scope = getPersistScopeForModelSelection(settings);
      settings.setValue(scope, 'security.auth.selectedType', AuthType.USE_OPENAI);
      settings.setValue(scope, 'model.name', 'gpt-5.4');
      writeStdoutLine(t('Switched to OpenAI (gpt-5.4).'));
      process.exit(0);
    } else {
      await handleOpenAIAuth(settings);
      process.exit(0);
    }
  } else if (choice === 'coding-plan') {
    await handleCeroclawdAuth('coding-plan', {});
  } else {
    await handleCeroclawdAuth('ceroclawd-oauth', {});
  }
}

/**
 * Shows the current authentication status
 */
export async function showAuthStatus(): Promise<void> {
  try {
    const settings = loadSettings();
    loadEnvironment(settings.merged);
    const mergedSettings = settings.merged as MergedSettingsWithCodingPlan;

    writeStdoutLine(t('\n=== Authentication Status ===\n'));

    const selectedType = mergedSettings.security?.auth?.selectedType;

    if (!selectedType) {
      writeStdoutLine(t('No authentication method configured.\n'));
      writeStdoutLine(t('Run one of the following commands to get started:\n'));
      writeStdoutLine(t('  ceroclawd auth glm          - Configure GLM / Z.AI'));
      writeStdoutLine(t('  ceroclawd auth openai        - Configure OpenAI (GPT-4o, Codex)'));
      writeStdoutLine(t('  ceroclawd auth ceroclawd-oauth - Authenticate with Ceroclawd OAuth'));
      writeStdoutLine(t('  ceroclawd auth coding-plan   - Configure Alibaba Cloud Coding Plan\n'));
      writeStdoutLine(t('Or simply run:'));
      writeStdoutLine(t('  ceroclawd auth               - Interactive setup\n'));
      process.exit(0);
    }

    if (selectedType === AuthType.USE_ANTHROPIC) {
      const hasKey = !!(process.env['ZAI_API_KEY'] || process.env['ANTHROPIC_API_KEY']);
      writeStdoutLine(t('Authentication Method: GLM / Z.AI'));
      writeStdoutLine(t('  Base URL: https://api.z.ai/api/anthropic'));
      writeStdoutLine(t('  Model: {{m}}', { m: mergedSettings.model?.name || 'glm-5.1' }));
      writeStdoutLine(t('  API key: {{s}}', { s: hasKey ? 'configured' : 'MISSING' }));
    } else if (selectedType === AuthType.USE_OPENAI) {
      const codingPlanRegion = mergedSettings.codingPlan?.region;
      const hasApiKey = !!(process.env[CODING_PLAN_ENV_KEY] || mergedSettings.env?.[CODING_PLAN_ENV_KEY]);
      const hasOpenAIKey = !!process.env[OPENAI_ENV_KEY];

      if (hasApiKey && codingPlanRegion) {
        writeStdoutLine(t('Authentication Method: Alibaba Cloud Coding Plan'));
        const regionDisplay = codingPlanRegion === CodingPlanRegion.CHINA ? 'China (aliyun.com)' : 'Global (alibabacloud.com)';
        writeStdoutLine(t('  Region: {{r}}', { r: regionDisplay }));
        writeStdoutLine(t('  Model: {{m}}', { m: mergedSettings.model?.name || '' }));
        writeStdoutLine(t('  Status: API key configured'));
      } else {
        writeStdoutLine(t('Authentication Method: OpenAI'));
        writeStdoutLine(t('  Base URL: https://api.openai.com/v1'));
        writeStdoutLine(t('  Model: {{m}}', { m: mergedSettings.model?.name || 'gpt-5.4' }));
        writeStdoutLine(t('  API key: {{s}}', { s: hasOpenAIKey ? 'configured' : 'MISSING - run: ceroclawd auth openai' }));
      }
    } else if (selectedType === AuthType.CEROCLAW_OAUTH) {
      writeStdoutLine(t('Authentication Method: Ceroclawd OAuth'));
      writeStdoutLine(t('  Type: Free tier - Up to 1,000 requests/day'));
    } else {
      writeStdoutLine(t('Authentication Method: {{type}}', { type: selectedType }));
      writeStdoutLine(t('  Status: Configured'));
    }

    writeStdoutLine(t(''));
    process.exit(0);
  } catch (error) {
    writeStderrLine(
      t('Failed to check authentication status: {{error}}', {
        error: getErrorMessage(error),
      }),
    );
    process.exit(1);
  }
}
