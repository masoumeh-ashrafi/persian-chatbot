// ارتباط مرورگر با سرور ما (نه مستقیم با سرویس هوش مصنوعی!).
// کلید API فقط روی سرور می‌مونه و هیچ‌وقت به این فایل نمی‌رسه.

export async function getHealth() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    return { serverUp: true, hasKey: Boolean(data.hasKey), model: data.model, provider: data.provider, keyName: data.keyName };
  } catch {
    return { serverUp: false, hasKey: false, model: null, provider: null, keyName: null };
  }
}

// پیام‌ها رو به /api/chat می‌فرسته و جواب جریانی (SSE) رو تکه‌تکه می‌خونه.
// برای هر تکه، onEvent صدا زده می‌شه: meta | text | done | error
export async function streamChat(messages, { onEvent, signal }) {
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw Object.assign(new Error('به سرور وصل نشدم. مطمئن شو npm run dev در حال اجراست.'), { code: 'SERVER_DOWN' });
  }

  if (!res.ok) {
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* بدنه‌ی JSON نبود */
    }
    throw Object.assign(new Error(data.message || 'خطای ناشناخته از سرور.'), { code: data.error || `HTTP_${res.status}` });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const block of events) {
      const line = block.trim();
      if (!line.startsWith('data:')) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()));
      } catch {
        /* تکه‌ی ناقص */
      }
    }
  }
}
