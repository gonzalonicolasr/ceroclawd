/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import {
  handleCeroclawdAuth,
  handleOpenAIAuth,
  handleGLMAuth,
  handleChatGPTAuth,
  runInteractiveAuth,
  showAuthStatus,
} from './auth/handler.js';
import { loadSettings } from '../config/settings.js';
import { t } from '../i18n/index.js';

// Define subcommands separately
const ceroclawdOauthCommand = {
  command: 'ceroclawd-oauth',
  describe: t('Authenticate using Ceroclawd OAuth'),
  handler: async () => {
    await handleCeroclawdAuth('ceroclawd-oauth', {});
  },
};

const codePlanCommand = {
  command: 'coding-plan',
  describe: t('Authenticate using Alibaba Cloud Coding Plan'),
  builder: (yargs: Argv) =>
    yargs
      .option('region', {
        alias: 'r',
        describe: t('Region for Coding Plan (china/global)'),
        type: 'string',
      })
      .option('key', {
        alias: 'k',
        describe: t('API key for Coding Plan'),
        type: 'string',
      }),
  handler: async (argv: { region?: string; key?: string }) => {
    const region = argv['region'] as string | undefined;
    const key = argv['key'] as string | undefined;

    if (region && key) {
      await handleCeroclawdAuth('coding-plan', { region, key });
    } else {
      await handleCeroclawdAuth('coding-plan', {});
    }
  },
};

const chatgptCommand = {
  command: 'chatgpt',
  describe: t('Authenticate with ChatGPT Plus/Pro subscription (OAuth - no API credits needed)'),
  handler: async () => {
    const settings = loadSettings();
    await handleChatGPTAuth(settings);
    process.exit(0);
  },
};

const openaiCommand = {
  command: 'openai',
  describe: t('Configure OpenAI (GPT-5.4, GPT-5.4 Mini, GPT-5.3-Codex)'),
  builder: (yargs: Argv) =>
    yargs.option('key', {
      alias: 'k',
      describe: t('OpenAI API key (sk-...)'),
      type: 'string',
    }),
  handler: async (argv: { key?: string }) => {
    const settings = loadSettings();
    await handleOpenAIAuth(settings, argv['key']);
    process.exit(0);
  },
};

const glmCommand = {
  command: 'glm',
  describe: t('Configure GLM / Z.AI (GLM-5.1, GLM-4.7, GLM-4.6)'),
  builder: (yargs: Argv) =>
    yargs.option('key', {
      alias: 'k',
      describe: t('Z.AI API key'),
      type: 'string',
    }),
  handler: async (argv: { key?: string }) => {
    const settings = loadSettings();
    await handleGLMAuth(settings, argv['key']);
    process.exit(0);
  },
};

const statusCommand = {
  command: 'status',
  describe: t('Show current authentication status'),
  handler: async () => {
    await showAuthStatus();
  },
};

export const authCommand: CommandModule = {
  command: 'auth',
  describe: t('Configure authentication: GLM/Z.AI, OpenAI, Ceroclawd OAuth, or Alibaba Cloud Coding Plan'),
  builder: (yargs: Argv) =>
    yargs
      .command(chatgptCommand)
      .command(glmCommand)
      .command(openaiCommand)
      .command(ceroclawdOauthCommand)
      .command(codePlanCommand)
      .command(statusCommand)
      .demandCommand(0)
      .version(false),
  handler: async () => {
    await runInteractiveAuth();
  },
};
