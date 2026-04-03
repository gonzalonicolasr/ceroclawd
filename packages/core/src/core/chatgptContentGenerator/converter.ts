/**
 * @license
 * Copyright 2025 Ceroclawd Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts from Google GenAI internal format to OpenAI Responses API format.
 * The Responses API input format is very similar to chat completions messages.
 */

import type {
  ContentListUnion,
  ToolListUnion,
} from '@google/genai';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertContentToOpenAI(contents: ContentListUnion | undefined): any[] {
  if (!contents) return [];

  const items = Array.isArray(contents) ? contents : [contents];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.flatMap((item: any) => {
    if (typeof item === 'string') {
      return [{ role: 'user', content: item }];
    }

    const role = item.role === 'model' ? 'assistant' : (item.role ?? 'user');
    const parts = item.parts ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults: any[] = [];

    for (const part of parts) {
      if (typeof part === 'string') {
        contentParts.push({ type: 'input_text', text: part });
      } else if (part.text !== undefined) {
        if (role === 'assistant') {
          contentParts.push({ type: 'output_text', text: part.text });
        } else {
          contentParts.push({ type: 'input_text', text: part.text });
        }
      } else if (part.functionCall) {
        // assistant tool call
        contentParts.push({
          type: 'function_call',
          call_id: part.functionCall.id ?? `call_${Date.now()}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        });
      } else if (part.functionResponse) {
        // tool result — separate item
        toolResults.push({
          type: 'function_call_output',
          call_id: part.functionResponse.id ?? `call_${Date.now()}`,
          output: JSON.stringify(part.functionResponse.response ?? {}),
        });
      } else if (part.inlineData) {
        contentParts.push({
          type: 'input_image',
          image_url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];

    if (contentParts.length > 0) {
      if (contentParts.length === 1 && contentParts[0].type === 'input_text' && role === 'user') {
        result.push({ role, content: contentParts[0].text });
      } else if (contentParts.length === 1 && contentParts[0].type === 'output_text' && role === 'assistant') {
        result.push({ role, content: contentParts[0].text });
      } else {
        result.push({ role, content: contentParts });
      }
    }

    result.push(...toolResults);

    return result;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertToolsToOpenAI(tools: ToolListUnion | undefined): any[] {
  if (!tools) return [];

  const toolList = Array.isArray(tools) ? tools : [tools];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = [];

  for (const tool of toolList) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = tool as any;
    if (t.functionDeclarations) {
      for (const fn of t.functionDeclarations) {
        result.push({
          type: 'function',
          name: fn.name,
          description: fn.description ?? '',
          parameters: fn.parameters ?? { type: 'object', properties: {} },
        });
      }
    }
  }

  return result;
}
