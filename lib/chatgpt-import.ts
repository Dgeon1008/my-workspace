import { createHash } from 'node:crypto';
import { Tiktoken } from 'js-tiktoken/lite';
import ranks from 'js-tiktoken/ranks/o200k_base';
import { ProjectError } from './project.ts';
import { seoulDay } from './token-activity.ts';

export type TokenMessage = { id: string; date: string; tokens: number; role: 'user' | 'assistant' };
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
let encoder: Tiktoken | undefined;

export function parseChatGPTExport(value: unknown, now = new Date()) {
  // Accept the conversation JSON itself or a wrapper used by export tools.
  const conversations = Array.isArray(value) ? value : object(value)?.conversations;
  if (!Array.isArray(conversations) || !conversations.length) throw new ProjectError('대화가 포함된 conversations JSON 파일을 선택해주세요. ZIP 파일은 먼저 압축을 풀어주세요.');
  const messages = new Map<string, TokenMessage>();
  let skipped = 0;
  let recognized = false;
  for (const item of conversations) {
    const conversation = object(item);
    const mapping = object(conversation?.mapping);
    const conversationId = conversation?.id ?? conversation?.conversation_id;
    if (!mapping || typeof conversationId !== 'string' || !conversationId) continue;
    recognized = true;
    for (const [nodeId, rawNode] of Object.entries(mapping)) {
      const message = object(object(rawNode)?.message);
      if (!message) continue;
      const role = object(message.author)?.role;
      if (role !== 'user' && role !== 'assistant') continue;
      if (object(message.metadata)?.is_visually_hidden_from_conversation === true || message.channel === 'analysis' || (typeof message.recipient === 'string' && message.recipient !== 'all')) continue;
      const content = object(message.content);
      const parts = content?.parts;
      const text = Array.isArray(parts) ? parts.filter((part): part is string => typeof part === 'string').join('\n') : '';
      const timestamp = message.create_time;
      if (!text.trim() || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) { skipped++; continue; }
      const date = new Date(timestamp * 1000);
      if (isNaN(date.getTime()) || date.getTime() < 0 || date.getTime() > now.getTime()) { skipped++; continue; }
      const rawId = typeof message.id === 'string' && message.id ? message.id : nodeId;
      const id = createHash('sha256').update(JSON.stringify([conversationId, rawId])).digest('hex');
      // Treat strings resembling special tokens as ordinary conversation text.
      encoder ??= new Tiktoken(ranks);
      const tokens = encoder.encode(text, [], []).length;
      messages.set(id, { id, date: seoulDay(date), tokens, role });
    }
  }
  if (!recognized) throw new ProjectError('지원하는 ChatGPT 대화 JSON 구조가 아닙니다. 기존 데이터는 변경하지 않았습니다.');
  if (!messages.size) throw new ProjectError('집계할 텍스트와 날짜가 있는 질문·답변을 찾지 못했습니다. 기존 데이터는 유지됩니다.');
  return { messages: [...messages.values()], skipped };
}
