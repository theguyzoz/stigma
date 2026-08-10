/**
 * --------------------------------------------------------------------------
 * GPT service — wired from the file you uploaded.
 * --------------------------------------------------------------------------
 *
 * Your original file was an ES module:
 *
 *   export async function gpt4oChat(config) { ... }
 *   export default gpt4oChat;
 *
 * Stigma's AI proxy (lib/ai.js) is CommonJS. It supports two shapes:
 *
 *   A) OpenAI-compatible — export { baseUrl, apiKey, model, toBody? }
 *   B) Custom            — export { chat: async ({ messages }) => any }
 *
 * The DeepEnglish proxy uses a non-standard URL and a non-OpenAI response
 * shape, so we use shape (B): a `chat` function that calls the proxy
 * exactly like your gpt4oChat() does and adapts the response to an
 * OpenAI-style payload so the rest of Stigma works without changes.
 *
 * SECURITY: the apiKey below is the one you shipped. Rotate it after this
 * is live, then drop the new value into process.env.AI_API_KEY or edit
 * this file. Better yet, set the env var and remove the literal.
 * --------------------------------------------------------------------------
 */

const DEEPENGLISH_URL = 'https://api.deepenglish.com/api/gpt_open_ai/chatnew';
const API_KEY = process.env.AI_API_KEY
  || 'UFkOfJaclj61OxoD7MnQknU1S2XwNdXMuSZA+EZGLkc='; // TODO: rotate
const DEFAULT_MODEL = 'gpt-4o';

async function callDeepEnglish({
  message,
  messages = [],
  systemInstruction,
  temperature,
  top_p,
  top_k,
  max_tokens,
}) {
  const sys = systemInstruction || 'You are a helpful, professional assistant.';
  const messageArray = [
    { role: 'system', content: sys },
    ...(messages || []).filter((m) => m && m.role !== 'system'),
  ];
  if (message) messageArray.push({ role: 'user', content: message });
  if (messageArray.length < 2) {
    return { success: false, error: 'Insufficient messages' };
  }

  const res = await fetch(DEEPENGLISH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      messages: messageArray,
      temperature: temperature ?? 0.7,
      top_p: top_p ?? 0.7,
      top_k: top_k ?? 40,
      max_tokens: max_tokens ?? 512,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${txt.slice(0, 100)}` };
  }
  const data = await res.json();
  if (!data || !data.success) {
    return { success: false, error: 'GPT service returned failure' };
  }
  return { success: true, answer: data.message, model: 'gpt-4o' };
}

module.exports = {
  // Display-only metadata for the developer console.
  baseUrl: DEEPENGLISH_URL,
  apiKey: API_KEY,
  model: DEFAULT_MODEL,

  /**
   * Custom chat hook — overrides the OpenAI-shaped default.
   * Mirrors your gpt4oChat() signature: takes a single user message and
   * builds the conversation array internally. Stigma's proxy always
   * passes the full `messages` array, so we use the last user message
   * as `message` and forward the rest as history.
   */
  chat: async ({ messages }) => {
    const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
    const history = (messages || []).filter((m) => m !== lastUser);
    const result = await callDeepEnglish({
      message: lastUser?.content || '',
      messages: history,
      temperature: 0.7,
      top_p: 0.7,
      top_k: 40,
      max_tokens: 512,
    });

    if (!result.success) {
      const err = new Error(result.error || 'upstream returned no success');
      err.upstream = result;
      throw err;
    }

    // Adapt to OpenAI-style response so the rest of Stigma (and the
    // developer console UI) just works.
    return {
      id: 'chatcmpl-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model || DEFAULT_MODEL,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.answer || '' },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  },
};
