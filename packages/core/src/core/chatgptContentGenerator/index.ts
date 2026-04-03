/**
 * @license
 * Copyright 2025 Ceroclawd Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ChatGPT OAuth Content Generator
 *
 * Uses ChatGPT Plus/Pro OAuth tokens to call the OpenAI Codex backend
 * (https://api.openai.com/v1/codex/responses) instead of the standard API.
 * This lets users use their ChatGPT subscription without paying for API credits.
 *
 * Flow: OAuth PKCE → access_token → /v1/codex/responses
 */

import OpenAI from 'openai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as https from 'node:https';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
} from '@google/genai';
import { FinishReason, GenerateContentResponse as GCR } from '@google/genai';
import type { Part } from '@google/genai';
import type { ContentGenerator } from '../contentGenerator.js';
import type { Config } from '../../config/config.js';
import { convertContentToOpenAI, convertToolsToOpenAI } from './converter.js';
import { createDebugLogger } from '../../utils/debugLogger.js';

const debugLogger = createDebugLogger('CHATGPT');

const CEROCLAW_DIR = '.ceroclawd';
const TOKENS_FILE = 'chatgpt-tokens.json';
const CODEX_BASE_URL = 'https://api.openai.com/v1/codex';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

export interface ChatGPTTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms timestamp
  accountId: string;
}

function getTokensPath(): string {
  return path.join(os.homedir(), CEROCLAW_DIR, TOKENS_FILE);
}

export function loadChatGPTTokens(): ChatGPTTokens | null {
  try {
    const data = fs.readFileSync(getTokensPath(), 'utf-8');
    return JSON.parse(data) as ChatGPTTokens;
  } catch {
    return null;
  }
}

export function saveChatGPTTokens(tokens: ChatGPTTokens): void {
  fs.writeFileSync(getTokensPath(), JSON.stringify(tokens, null, 2), 'utf-8');
}

function decodeJWTPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function extractAccountId(accessToken: string): string {
  const payload = decodeJWTPayload(accessToken);
  return (payload['sub'] as string) ?? (payload['account_id'] as string) ?? '';
}

async function refreshTokens(refreshToken: string): Promise<ChatGPTTokens> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    });

    const url = new URL(TOKEN_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
          };
          if (!parsed.access_token) {
            reject(new Error(`Token refresh failed: ${data}`));
            return;
          }
          const tokens: ChatGPTTokens = {
            accessToken: parsed.access_token,
            refreshToken: parsed.refresh_token ?? refreshToken,
            expiresAt: Date.now() + (parsed.expires_in * 1000),
            accountId: extractAccountId(parsed.access_token),
          };
          resolve(tokens);
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

async function getValidTokens(): Promise<ChatGPTTokens> {
  const tokens = loadChatGPTTokens();
  if (!tokens) {
    throw new Error(
      'ChatGPT not authenticated. Run: ceroclawd auth chatgpt'
    );
  }

  // Refresh if expires within 5 minutes
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    debugLogger.debug('Refreshing ChatGPT token...');
    const refreshed = await refreshTokens(tokens.refreshToken);
    saveChatGPTTokens(refreshed);
    return refreshed;
  }

  return tokens;
}

function buildOpenAIClient(accessToken: string): OpenAI {
  return new OpenAI({
    apiKey: accessToken,
    baseURL: CODEX_BASE_URL,
    defaultHeaders: {
      'openai-beta': 'responses=v1',
    },
    maxRetries: 2,
  });
}

export class ChatGPTOAuthContentGenerator implements ContentGenerator {
  constructor(
    private model: string,
    _cliConfig: Config,
  ) {}

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const tokens = await getValidTokens();
    const client = buildOpenAIClient(tokens.accessToken);

    const input = convertContentToOpenAI(request.contents);
    const tools = convertToolsToOpenAI(request.config?.tools);

    debugLogger.debug(`ChatGPT request model=${this.model} input_items=${input.length}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model: this.model,
      input,
    };
    if (tools && tools.length > 0) params.tools = tools;
    if (tokens.accountId) params['openai-account-id'] = tokens.accountId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.responses as any).create(params);

    return convertResponseToGenAI(response);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const tokens = await getValidTokens();
    const client = buildOpenAIClient(tokens.accessToken);

    const input = convertContentToOpenAI(request.contents);
    const tools = convertToolsToOpenAI(request.config?.tools);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model: this.model,
      input,
      stream: true,
    };
    if (tools && tools.length > 0) params.tools = tools;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await (client.responses as any).stream(params);

    return streamResponseToGenAI(stream);
  }

  async countTokens(
    _request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return { totalTokens: 0 };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('Embeddings not supported by ChatGPT OAuth generator.');
  }

  useSummarizedThinking(): boolean {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertResponseToGenAI(response: any): GenerateContentResponse {
  const parts: Part[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolCalls: any[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of response.output ?? []) {
    if (item.type === 'message') {
      for (const c of item.content ?? []) {
        if (c.type === 'output_text') parts.push({ text: c.text ?? '' });
      }
    } else if (item.type === 'function_call') {
      toolCalls.push(item);
    }
  }

  for (const tc of toolCalls) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.arguments ?? '{}') as Record<string, unknown>; } catch { /* ignore */ }
    parts.push({ functionCall: { id: tc.call_id ?? tc.id, name: tc.name, args } });
  }

  const result = new GCR();
  result.candidates = [{
    content: { role: 'model' as const, parts },
    finishReason: FinishReason.STOP,
    index: 0,
  }];
  result.usageMetadata = {
    promptTokenCount: response.usage?.input_tokens ?? 0,
    candidatesTokenCount: response.usage?.output_tokens ?? 0,
    totalTokenCount: response.usage?.total_tokens ?? 0,
  };
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function* streamResponseToGenAI(stream: any): AsyncGenerator<GenerateContentResponse> {
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      const chunk = new GCR();
      chunk.candidates = [{
        content: { role: 'model' as const, parts: [{ text: event.delta ?? '' }] },
        index: 0,
      }];
      yield chunk;
    } else if (event.type === 'response.completed') {
      const r = event.response;
      const final = new GCR();
      final.candidates = [{
        content: { role: 'model' as const, parts: [] },
        finishReason: FinishReason.STOP,
        index: 0,
      }];
      if (r?.usage) {
        final.usageMetadata = {
          promptTokenCount: r.usage.input_tokens ?? 0,
          candidatesTokenCount: r.usage.output_tokens ?? 0,
          totalTokenCount: r.usage.total_tokens ?? 0,
        };
      }
      yield final;
    }
  }
}

