import React from 'react';

// وقتی سرور خاموشه یا کلید API نیست، به‌جای ارور گنگ، راه‌حل قدم‌به‌قدم نشون می‌دیم.
export default function SetupCard({ health, onRecheck, checking }) {
  if (health.loading || (health.serverUp && health.hasKey)) return null;

  if (!health.serverUp) {
    return (
      <section className="setup" aria-live="polite">
        <h2>سرور در دسترس نیست</h2>
        <p>رابط چت بالا اومده ولی به سرور وصل نمی‌شه. توی ترمینال، داخل پوشه‌ی پروژه این دستور رو بزن:</p>
        <pre dir="ltr">npm run dev</pre>
        <button type="button" className="btn-primary" onClick={onRecheck} disabled={checking}>
          {checking ? 'در حال بررسی…' : 'بررسی دوباره'}
        </button>
      </section>
    );
  }

  if (health.provider === 'openai') {
    return (
      <section className="setup" aria-live="polite">
        <h2>یه قدم تا شروع: کلید سرویس هوش مصنوعی</h2>
        <ol>
          <li>از سرویس‌دهنده‌ات (هر سرویس سازگار با OpenAI) یه کلید API و آدرس سرویسش رو بگیر.</li>
          <li>
            توی فایل <code dir="ltr">.env</code> این‌ها رو پر کن: <code dir="ltr">OPENAI_API_KEY</code> و <code dir="ltr">OPENAI_BASE_URL</code> و <code dir="ltr">OPENAI_MODEL</code>
          </li>
          <li>
            سرور رو ببند (<code dir="ltr">Ctrl + C</code>) و دوباره بزن <code dir="ltr">npm run dev</code>.
          </li>
        </ol>
        <button type="button" className="btn-primary" onClick={onRecheck} disabled={checking}>
          {checking ? 'در حال بررسی…' : 'انجام دادم، بررسی کن'}
        </button>
      </section>
    );
  }

  return (
    <section className="setup" aria-live="polite">
      <h2>یه قدم تا شروع: کلید Gemini</h2>
      <ol>
        <li>
          وارد <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a> شو، از منوی کناری «Get API key» و بعد «Create API key» رو بزن و کلید رو کپی کن.
        </li>
        <li>
          توی پوشه‌ی پروژه، فایل <code dir="ltr">.env.example</code> رو کپی کن و اسمش رو بذار <code dir="ltr">.env</code>. بعد کلیدت رو بذار جلوی <code dir="ltr">GEMINI_API_KEY=</code>
        </li>
        <li>
          سرور رو ببند (<code dir="ltr">Ctrl + C</code>) و دوباره بزن <code dir="ltr">npm run dev</code>.
        </li>
      </ol>
      <button type="button" className="btn-primary" onClick={onRecheck} disabled={checking}>
        {checking ? 'در حال بررسی…' : 'انجام دادم، بررسی کن'}
      </button>
    </section>
  );
}
