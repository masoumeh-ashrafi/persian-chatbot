import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT } from './prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT) || 3001;

// اگه سرویس تا این مدت شروع به جواب دادن نکنه، خطا نشون می‌دیم (به‌جای انتظار بی‌پایان)
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || Number(process.env.LLM_TIMEOUT_MS) || 30000;

// اختیاری: اگه سرور برای رسیدن به سرویس به پروکسی نیاز داره، آدرسش رو توی .env بذار
// مثال: LLM_PROXY=http://127.0.0.1:10809   (اسم قدیمی GEMINI_PROXY هم کار می‌کنه)
// (Node خودش تنظیمات پروکسی مرورگر یا برنامه‌ی وی‌پی‌ان رو نمی‌خونه)
const PROXY_URL = (process.env.LLM_PROXY || process.env.GEMINI_PROXY || '').trim();
let upstreamFetch = fetch;
let dispatcher;
if (PROXY_URL) {
  try {
    const undici = await import('undici');
    dispatcher = new undici.ProxyAgent(PROXY_URL);
    upstreamFetch = undici.fetch;
  } catch (err) {
    console.error('  پروکسی تنظیم نشد (npm install رو دوباره بزن):', err.message);
  }
}

/* ---------- انتخاب سرویس هوش مصنوعی ---------- */
// LLM_PROVIDER=gemini  (پیش‌فرض) یا  LLM_PROVIDER=openai  (هر سرویس سازگار با OpenAI)
const requested = (process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase();
if (requested !== 'gemini' && requested !== 'openai') {
  console.warn(`  مقدار LLM_PROVIDER («${requested}») ناشناخته‌ست؛ از gemini استفاده می‌شه.`);
}
const CFG =
  requested === 'openai'
    ? {
        id: 'openai',
        label: 'سرویس OpenAI-سازگار',
        keyName: 'OPENAI_API_KEY',
        key: (process.env.OPENAI_API_KEY || '').trim(),
        model: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
        base: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/+$/, ''),
      }
    : {
        id: 'gemini',
        label: 'Gemini',
        keyName: 'GEMINI_API_KEY',
        key: (process.env.GEMINI_API_KEY || '').trim(),
        model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
        base: (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').trim().replace(/\/+$/, ''),
      };

// محدودیت‌ها (برای محافظت از کلید و سهمیه‌ی تو)
const MAX_MESSAGES = 20; // حداکثر تعداد پیام تاریخچه
const MAX_CHARS = 2000; // حداکثر طول هر پیام
const RATE_WINDOW_MS = 10 * 60 * 1000; // ۱۰ دقیقه
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 40; // تعداد درخواست مجاز در هر بازه برای هر IP

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

/* ---------- محدودیت تعداد درخواست (ساده، داخل حافظه) ---------- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    const recent = list.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length) hits.set(ip, recent);
    else hits.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

/* ---------- اعتبارسنجی ورودی ---------- */
// فقط نقش‌های user و assistant قبول می‌شن. کاربر نمی‌تونه پیام «system» بفرسته.
function parseMessages(body) {
  const list = body && body.messages;
  if (!Array.isArray(list) || list.length === 0) {
    return { error: 'پیامی ارسال نشده.' };
  }
  const messages = list.slice(-MAX_MESSAGES).map((m) => (m && typeof m === 'object' ? { role: m.role, content: m.content } : m));
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return { error: 'قالب پیام‌ها درست نیست.' };
    }
    if (m.content.length > MAX_CHARS) {
      return { error: `هر پیام حداکثر ${MAX_CHARS} کاراکتر می‌تونه باشه.` };
    }
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return { error: 'آخرین پیام باید از طرف کاربر باشه.' };
  }
  if (!messages[messages.length - 1].content.trim()) {
    return { error: 'پیام خالیه.' };
  }
  return { messages };
}

/* ---------- ساخت درخواست برای هر سرویس ---------- */
function buildUpstream(messages) {
  if (CFG.id === 'openai') {
    return {
      url: `${CFG.base}/chat/completions`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CFG.key}` },
      body: {
        model: CFG.model,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      },
      shown: messages,
    };
  }
  // Gemini: نقش assistant اونجا «model» نام داره
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  return {
    url: `${CFG.base}/v1beta/models/${encodeURIComponent(CFG.model)}:streamGenerateContent?alt=sse`,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CFG.key },
    body: {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    },
    shown: contents,
  };
}

// خوندن یه تکه از جواب جریانی (هر سرویس قالب خودش رو داره)
function readChunk(json) {
  if (CFG.id === 'openai') {
    if (json.error) return { error: json.error.message || 'خطا از سمت سرویس' };
    const c = json.choices && json.choices[0];
    if (!c) return {};
    const text = c.delta && typeof c.delta.content === 'string' ? c.delta.content : '';
    return { text, finish: c.finish_reason || null };
  }
  if (json.promptFeedback && json.promptFeedback.blockReason) return { blocked: true };
  const cand = json.candidates && json.candidates[0];
  if (!cand) return {};
  const text = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
  return { text, finish: cand.finishReason || null };
}

/* ---------- ترجمه‌ی خطاها به پیام قابل‌فهم ---------- */
function looksLikeHtml(text) {
  return /^\s*(<!doctype html|<html)/i.test(text || '');
}

function explainError(status, detail) {
  const d = (detail || '').toLowerCase();
  // صفحه‌ی HTML با کد ۴۰۳: درخواست قبل از رسیدن به API رد شده (معمولاً آی‌پی یا منطقه)
  if (looksLikeHtml(detail) && (status === 403 || status === 451)) {
    return {
      code: 'GEO_BLOCK',
      message: `${CFG.label} این درخواست رو قبل از رسیدن به API رد کرد (خطای ۴۰۳ با صفحه‌ی HTML). معمولاً یعنی آی‌پی یا منطقه‌ی شبکه‌ی سرور پشتیبانی نمی‌شه، نه اینکه کلیدت مشکل داشته باشه. شبکه رو عوض کن یا از یه سرویس دیگه استفاده کن (بخش «اگه خطای ۴۰۳ گرفتی» توی README).`,
    };
  }
  if (d.includes('location is not supported')) {
    return { code: 'REGION', message: `${CFG.label} این سرویس رو برای موقعیت فعلی شبکه‌ت پشتیبانی نمی‌کنه.` };
  }
  if (d.includes('api key not valid') || d.includes('api_key_invalid') || status === 401) {
    return { code: 'BAD_KEY', message: 'کلید API معتبر نیست. کلید داخل فایل .env رو دوباره چک کن.' };
  }
  if (status === 429) {
    return { code: 'QUOTA', message: 'سهمیه‌ی درخواست‌ها پر شده. چند دقیقه صبر کن و دوباره امتحان کن.' };
  }
  if (status === 403) {
    return { code: 'FORBIDDEN', message: 'دسترسی رد شد. کلید API یا دسترسی شبکه‌ت رو چک کن.' };
  }
  if (status === 404) {
    return { code: 'BAD_MODEL', message: `مدل «${CFG.model}» یا آدرس سرویس پیدا نشد. اسم مدل و آدرس داخل .env رو چک کن.` };
  }
  if (status >= 500) {
    return { code: 'UPSTREAM', message: `سرویس ${CFG.label} الان شلوغه یا مشکل داره. کمی بعد دوباره امتحان کن.` };
  }
  return { code: 'UPSTREAM', message: `خطایی از سمت ${CFG.label} برگشت. دوباره امتحان کن.` };
}

/* ---------- مسیرهای API ---------- */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(CFG.key), model: CFG.model, provider: CFG.id, keyName: CFG.keyName });
});

app.post('/api/chat', async (req, res) => {
  if (!CFG.key) {
    return res.status(503).json({ error: 'NO_KEY', message: `کلید ${CFG.keyName} تنظیم نشده.` });
  }
  if (rateLimited(req.ip)) {
    return res.status(429).json({ error: 'RATE_LIMIT', message: 'درخواست‌ها زیاد بود. چند دقیقه صبر کن.' });
  }
  const parsed = parseMessages(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: 'BAD_INPUT', message: parsed.error });
  }

  const upstreamReq = buildUpstream(parsed.messages);

  // از اینجا به بعد جواب به‌صورت جریانی (SSE) برای مرورگر فرستاده می‌شه
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const started = Date.now();
  // اطلاعات «پشت صحنه» برای حالت آموزشی (کلید API هیچ‌وقت اینجا نمیاد)
  send({
    type: 'meta',
    model: CFG.model,
    provider: CFG.id,
    systemPrompt: SYSTEM_PROMPT,
    sentToModel: upstreamReq.shown,
  });

  const controller = new AbortController();
  let timedOut = false;
  res.on('close', () => controller.abort());
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const upstream = await upstreamFetch(upstreamReq.url, {
      method: 'POST',
      headers: upstreamReq.headers,
      body: JSON.stringify(upstreamReq.body),
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    clearTimeout(timer); // جواب شروع شد؛ از اینجا به بعد منتظر تکه‌های بعدی می‌مونیم

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error(`${CFG.label} error ${upstream.status}:`, looksLikeHtml(detail) ? '(صفحه‌ی HTML خطا)' : detail.slice(0, 300));
      const { code, message } = explainError(upstream.status, detail);
      send({ type: 'error', code, message });
      return res.end();
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let chars = 0;
    let finishReason = null;
    let blocked = false;
    let streamError = null;

    const handleLine = (rawLine) => {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) return;
      let json;
      try {
        json = JSON.parse(line.slice(5).trim());
      } catch {
        return; // مثلاً data: [DONE]
      }
      const out = readChunk(json);
      if (out.blocked) blocked = true;
      if (out.error) streamError = out.error;
      if (out.text) {
        chars += out.text.length;
        send({ type: 'text', text: out.text });
      }
      if (out.finish) finishReason = out.finish;
    };

    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach(handleLine);
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);

    if (blocked) {
      send({ type: 'error', code: 'BLOCKED', message: 'این پیام توسط فیلتر ایمنی مدل رد شد. جور دیگه بپرس.' });
    } else if (streamError && chars === 0) {
      send({ type: 'error', code: 'UPSTREAM', message: `خطا از سمت ${CFG.label}: ${streamError}` });
    } else if (chars === 0) {
      send({ type: 'error', code: 'EMPTY', message: 'مدل جوابی نفرستاد. دوباره امتحان کن.' });
    } else {
      send({ type: 'done', latencyMs: Date.now() - started, chars, finishReason });
    }
    res.end();
  } catch (err) {
    clearTimeout(timer);
    if (timedOut) {
      console.error(`${CFG.label} تا ${TIMEOUT_MS / 1000} ثانیه جواب نداد.`);
      send({
        type: 'error',
        code: 'TIMEOUT',
        message: `${CFG.label} تا ${Math.round(TIMEOUT_MS / 1000)} ثانیه جواب نداد. معمولاً یعنی سرور پروژه به سرویس دسترسی نداره (حتی اگه مرورگرت داره). بخش «اگه سرور به سرویس نمی‌رسه» توی README رو ببین.`,
      });
      return res.end();
    }
    if (controller.signal.aborted) return; // کاربر صفحه رو بسته
    console.error('Chat error:', err && err.message, err && err.cause && err.cause.code);
    send({
      type: 'error',
      code: 'NETWORK',
      message: `اتصال به ${CFG.label} برقرار نشد. اینترنت یا فیلتر شبکه‌ی سرور رو چک کن (بخش «اگه سرور به سرویس نمی‌رسه» توی README).`,
    });
    res.end();
  }
});

// مسیر ناشناخته‌ی API باید ۴۰۴ بده، نه صفحه‌ی اصلی
app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'این مسیر وجود نداره.' }));

/* ---------- سرو کردن نسخه‌ی ساخته‌شده (بعد از npm run build) ---------- */
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n  سرور روی http://localhost:${PORT} آماده‌ست`);
  console.log(`  سرویس: ${CFG.label} | مدل: ${CFG.model}`);
  console.log(CFG.key ? '  کلید API: تنظیم شده ✓' : `  کلید API: تنظیم نشده ✗ (${CFG.keyName} رو توی .env بذار، README رو ببین)`);
  if (dispatcher) console.log(`  پروکسی: ${PROXY_URL}`);
  console.log('');
});
