/**
 * AI chat proxy. Loads the upstream provider from /ai/gpt.js at request time.
 *
 * The template can be either of:
 *
 *   A) OpenAI-compatible. Export:
 *        { baseUrl, apiKey, model, toBody? }
 *      We POST `${baseUrl}/chat/completions` and forward the response
 *      verbatim. Good for OpenAI, OpenRouter, Together, local llama.cpp
 *      with an OpenAI shim, etc.
 *
 *   B) Custom. Export:
 *        { baseUrl, apiKey, model, chat: async ({ messages }) => any }
 *      `chat` is fully in charge of the upstream call. The shape you
 *      return becomes the response body. Use this for proxies whose
 *      URL or response format differs from OpenAI.
 *
 *   C) Bare stub. None of the above. We return a friendly 200 so the rest
 *      of the system keeps working.
 */
const fs = require('fs');
const path = require('path');

let cached = null;
function load() {
  if (cached) return cached;
  const p = path.join(__dirname, '..', 'ai', 'gpt.js');
  if (fs.existsSync(p)) {
    try { cached = require(p); return cached; } catch {}
  }
  return null;
}

async function chat({ messages }) {
  const tpl = load();
  if (!tpl) {
    return {
      id: 'stub-' + Date.now(),
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'No pollens found. The AI provider is not configured yet — drop your gpt.js file into /ai.'
        },
        finish_reason: 'stop'
      }],
      model: 'stigma-stub'
    };
  }

  // Custom chat() — full control
  if (typeof tpl.chat === 'function') {
    return await tpl.chat({ messages });
  }

  // OpenAI-compatible path
  if (tpl.baseUrl && tpl.apiKey && tpl.model) {
    const body = (tpl.toBody ? tpl.toBody(messages) : { messages });
    const res = await fetch(`${tpl.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tpl.apiKey}`
      },
      body: JSON.stringify({ model: tpl.model, ...body })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('AI upstream ' + res.status + ': ' + txt.slice(0, 200));
    }
    return await res.json();
  }

  // Fallback stub
  return {
    id: 'stub-' + Date.now(),
    choices: [{
      message: { role: 'assistant', content: 'Something went wrong with another. The AI template is incomplete.' }
    }]
  };
}

module.exports = { chat };
