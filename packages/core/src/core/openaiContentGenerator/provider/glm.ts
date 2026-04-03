/**
 * @license
 * Copyright 2025 Ceroclawd
 * SPDX-License-Identifier: Apache-2.0
 */

import type OpenAI from 'openai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';

const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/';

/**
 * Provider for Zhipu AI GLM models (GLM-4, GLM-Z1, GLM-5, etc.)
 * Uses the OpenAI-compatible endpoint at open.bigmodel.cn
 */
export class GLMOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    // Inject the GLM base URL if not already set
    const config = contentGeneratorConfig.baseUrl
      ? contentGeneratorConfig
      : { ...contentGeneratorConfig, baseUrl: GLM_BASE_URL };
    super(config, cliConfig);
  }

  static isGLMProvider(
    contentGeneratorConfig: ContentGeneratorConfig,
  ): boolean {
    const baseUrl = contentGeneratorConfig.baseUrl ?? '';
    const url = baseUrl.toLowerCase();
    return url.includes('open.bigmodel.cn') || url.includes('api.z.ai');
  }

  static getDefaultBaseUrl(): string {
    return GLM_BASE_URL;
  }

  /**
   * GLM models do not reliably support parallel tool calls.
   * Disabling it avoids double-request loops and speeds up tool execution.
   */
  override buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    const base = super.buildRequest(request, userPromptId);
    return {
      ...base,
      parallel_tool_calls: false,
    };
  }
}
