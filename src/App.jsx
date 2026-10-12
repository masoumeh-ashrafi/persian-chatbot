import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getHealth, streamChat } from './lib/chat.js';
import { loadPref, savePref } from './lib/storage.js';
import Message from './components/Message.jsx';
import Tour from './components/Tour.jsx';
import SetupCard from './components/SetupCard.jsx';
import { StarIcon, SendIcon, StopIcon, ResetIcon, HelpIcon, MoonIcon, SunIcon } from './components/Icons.jsx';

const WELCOME =
  'سلام! من یار برنامه‌نویسم. هر سوالی درباره‌ی برنامه‌نویسی، پایتون، چت‌بات یا ابزارهای هوش مصنوعی داری بپرس. جواب‌ها رو کوتاه و ساده می‌دم.';

const SUGGESTIONS = [
  'از کجا برنامه‌نویسی رو شروع کنم؟',
  'فرق پایتون و جاوااسکریپت چیه؟',
  'یه چت‌بات چطور ساخته می‌شه؟',
  'حس می‌کنم پیشرفت نمی‌کنم، چی کار کنم؟',
];
const EDU_SUGGESTION = 'تو چطور ساخته شدی؟ قدم‌به‌قدم بگو';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState({ loading: true, serverUp: false, hasKey: false });
  const [checking, setChecking] = useState(false);
  const [edu, setEdu] = useState(() => loadPref('edu', false));
  const [theme, setTheme] = useState(() => loadPref('theme', null)); // null یعنی مثل سیستم
  const [tourOpen, setTourOpen] = useState(() => !loadPref('tourDone', false));

  const idRef = useRef(0);
  const abortRef = useRef(null);
  const logRef = useRef(null);
  const stickRef = useRef(true);
  const inputRef = useRef(null);

  /* ---------- سلامت سرور و کلید ---------- */
  const checkHealth = useCallback(async () => {
    setChecking(true);
    const h = await getHealth();
    setHealth({ loading: false, ...h });
    setChecking(false);
  }, []);
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  /* ---------- تم ---------- */
  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
  }, [theme]);

  const isDark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    savePref('theme', next);
  };

  const toggleEdu = () => {
    setEdu((v) => {
      savePref('edu', !v);
      return !v;
    });
  };

  const closeTour = () => {
    setTourOpen(false);
    savePref('tourDone', true);
    inputRef.current && inputRef.current.focus();
  };

  /* ---------- اسکرول خودکار (فقط اگه کاربر پایین صفحه‌ست) ---------- */
  const onScroll = () => {
    const el = logRef.current;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  useEffect(() => {
    const el = logRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, health]);

  /* ---------- بزرگ شدن خودکار کادر نوشتن ---------- */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  /* ---------- ارسال پیام ---------- */
  const send = useCallback(
    async (raw, baseMessages) => {
      const text = (raw || '').trim();
      if (!text || busy) return;

      const prior = baseMessages || messages;
      const userId = ++idRef.current;
      const botId = ++idRef.current;
      const userMsg = { id: userId, role: 'user', content: text };

      // تاریخچه‌ای که به سرور می‌ره: پیام‌های ناموفق رو حذف می‌کنیم
      const history = [...prior, userMsg].filter((m) => !m.failed && !m.error).map(({ role, content }) => ({ role, content }));

      stickRef.current = true;
      setMessages([...prior, userMsg, { id: botId, role: 'assistant', content: '', streaming: true }]);
      setInput('');
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchBot = (fn) => setMessages((prev) => prev.map((m) => (m.id === botId ? fn(m) : m)));
      const fail = (message, code) =>
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === userId) return { ...m, failed: true };
            if (m.id === botId) return { ...m, streaming: false, error: message, errorCode: code };
            return m;
          })
        );

      try {
        await streamChat(history, {
          signal: controller.signal,
          onEvent: (ev) => {
            if (ev.type === 'meta') {
              patchBot((m) => ({ ...m, debug: { model: ev.model, systemPrompt: ev.systemPrompt, sentToModel: ev.sentToModel } }));
            } else if (ev.type === 'text') {
              patchBot((m) => ({ ...m, content: m.content + ev.text }));
            } else if (ev.type === 'done') {
              patchBot((m) => ({ ...m, streaming: false, debug: { ...m.debug, latencyMs: ev.latencyMs, chars: ev.chars } }));
            } else if (ev.type === 'error') {
              fail(ev.message, ev.code);
            }
          },
        });
        patchBot((m) => (m.streaming ? { ...m, streaming: false } : m));
      } catch (err) {
        if (err.name === 'AbortError') {
          patchBot((m) => ({ ...m, streaming: false, content: m.content || '(متوقف شد)' }));
        } else {
          fail(err.message || 'مشکلی پیش اومد.', err.code);
          if (err.code === 'NO_KEY' || err.code === 'SERVER_DOWN') checkHealth();
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, checkHealth]
  );

  const retry = (botId) => {
    const idx = messages.findIndex((m) => m.id === botId);
    const userMsg = messages[idx - 1];
    if (!userMsg) return;
    send(userMsg.content, messages.slice(0, idx - 1));
  };

  const stop = () => abortRef.current && abortRef.current.abort();

  const reset = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setInput('');
    stickRef.current = true;
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const ready = health.loading || (health.serverUp && health.hasKey);
  const firstBotId = (messages.find((m) => m.role === 'assistant') || {}).id;
  const suggestions = edu ? [...SUGGESTIONS, EDU_SUGGESTION] : SUGGESTIONS;
  const status = health.loading ? 'در حال بررسی…' : !health.serverUp ? 'سرور خاموشه' : !health.hasKey ? 'نیاز به کلید API' : busy ? 'در حال نوشتن…' : 'آماده‌ی پاسخ';

  return (
    <div className="stage">
      <main className={`phone${busy ? ' thinking' : ''}`} aria-label="گفتگو با یار برنامه‌نویس">
        <header className="top">
          <div className="avatar" aria-hidden="true">
            <StarIcon />
          </div>
          <div className="who">
            <h1>یار برنامه‌نویس</h1>
            <p>{status}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setTourOpen(true)} aria-label="راهنمای استفاده" title="راهنما">
            <HelpIcon />
          </button>
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="تغییر حالت روشن و تیره" title="روشن / تیره">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button type="button" className="icon-btn" onClick={reset} aria-label="شروع گفتگوی تازه" title="گفتگوی تازه">
            <ResetIcon />
          </button>
        </header>

        <div className={`edubar${edu ? ' on' : ''}`}>
          <div className="edu-text">
            <strong>حالت آموزشی</strong>
            <span>{edu ? 'روشنه: زیر هر پاسخ، پشت صحنه‌ش رو می‌بینی' : 'روشنش کن تا ببینی چت‌بات چطور کار می‌کنه'}</span>
          </div>
          <button type="button" role="switch" aria-checked={edu} aria-label="حالت آموزشی" className="switch" onClick={toggleEdu}>
            <span className="knob" />
          </button>
        </div>

        <section className="log" ref={logRef} onScroll={onScroll} aria-live="polite">
          <div className="bot-wrap">
            <div className="msg bot">{WELCOME}</div>
          </div>

          <SetupCard health={health} onRecheck={checkHealth} checking={checking} />

          {edu && messages.length === 0 && ready && (
            <aside className="edu-intro">
              <strong>حالت آموزشی روشنه</strong>
              <p>یه سوال بپرس. بعد از جواب، زیرش یه بخش «پشت صحنه» باز می‌شه و نشون می‌ده پیامت از مرورگر تا مدل هوش مصنوعی و برگشت چه مسیری رفته.</p>
            </aside>
          )}

          {messages.map((m) => (
            <Message key={m.id} m={m} edu={edu} firstBot={m.id === firstBotId} onRetry={busy ? null : retry} />
          ))}
        </section>

        {messages.length === 0 && ready && (
          <div className="chips">
            {suggestions.map((q) => (
              <button type="button" key={q} className="chip" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="composer">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={ready ? 'سوالت رو بنویس…' : 'اول مراحل راه‌اندازی بالا رو انجام بده'}
            aria-label="پیام"
            maxLength={2000}
            disabled={!ready}
          />
          {busy ? (
            <button type="button" className="send stop" onClick={stop} aria-label="توقف پاسخ" title="توقف">
              <StopIcon />
            </button>
          ) : (
            <button type="button" className="send" onClick={() => send(input)} disabled={!ready || !input.trim()} aria-label="ارسال پیام">
              <SendIcon />
            </button>
          )}
        </div>
        <p className="note">پاسخ‌ها را هوش مصنوعی می‌نویسد. قبل از استفاده در پروژه، بررسی‌شان کن.</p>
      </main>

      {tourOpen && <Tour onClose={closeTour} />}
    </div>
  );
}
