import React from 'react';

// «پشت صحنه»: توی حالت آموزشی، مسیر واقعی یه پیام رو قدم‌به‌قدم نشون می‌ده.
export default function BehindScenes({ debug, streaming, defaultOpen }) {
  if (!debug || !debug.sentToModel) return null;

  const sent = debug.sentToModel.slice(-6);
  const seconds = debug.latencyMs ? (debug.latencyMs / 1000).toFixed(1) : null;

  const steps = [
    {
      title: 'مرورگر پیامت رو می‌فرسته',
      file: 'src/App.jsx → send()',
      text: `پیامت و تاریخچه‌ی گفتگو (${debug.sentToModel.length} پیام) به آدرس /api/chat روی سرور خودمون فرستاده می‌شه. مرورگر هیچ‌وقت مستقیم با سرویس هوش مصنوعی حرف نمی‌زنه.`,
    },
    {
      title: 'سرور پرامپت سیستمی رو اضافه می‌کنه',
      file: 'server/index.js + server/prompt.js',
      text: 'سرور پیامت رو اعتبارسنجی می‌کنه، دستورهای ثابت ربات (پرامپت سیستمی) رو بهش می‌چسبونه و کلید API رو که فقط خودش داره کنارش می‌ذاره.',
    },
    {
      title: streaming ? 'مدل داره جواب رو می‌سازه…' : 'مدل جواب رو ساخت',
      file: `مدل: ${debug.model}`,
      text: seconds ? `مدل جواب رو تکه‌تکه (streaming) برگردوند و کل کار حدود ${seconds} ثانیه طول کشید.` : 'مدل جواب رو تکه‌تکه برمی‌گردونه، برای همین کلمه‌به‌کلمه می‌بینیش.',
    },
    {
      title: 'جواب روی صفحه نشون داده می‌شه',
      file: 'src/components/Markdown.jsx',
      text: `هر تکه که می‌رسه، به متن اضافه می‌شه و Markdown (بولد، لیست، کد) به شکل قشنگ نمایش داده می‌شه.${debug.chars ? ` طول جواب: ${debug.chars} کاراکتر.` : ''}`,
    },
  ];

  return (
    <details className="behind" open={defaultOpen}>
      <summary>
        <span className="behind-dot" aria-hidden="true" />
        پشت صحنه‌ی این پاسخ
      </summary>

      <ol className="pipeline">
        {steps.map((s) => (
          <li key={s.title}>
            <strong>{s.title}</strong>
            <code className="file" dir="ltr">
              {s.file}
            </code>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>

      <details className="inner">
        <summary>پرامپت سیستمی چیه؟ (ببینش)</summary>
        <p className="gloss">پرامپت سیستمی دستورهاییه که تو نمی‌بینی ولی رفتار ربات رو مشخص می‌کنه: لحن، حدود کار و اینکه به چی جواب بده.</p>
        <pre dir="ltr">{debug.systemPrompt}</pre>
      </details>

      <details className="inner">
        <summary>پیامی که واقعاً به مدل رفت</summary>
        <p className="gloss">مدل حافظه نداره. هر بار کل تاریخچه دوباره براش فرستاده می‌شه. «model» یعنی جواب‌های قبلی خودش.</p>
        <pre dir="ltr">{JSON.stringify(sent, null, 2)}</pre>
      </details>
    </details>
  );
}
