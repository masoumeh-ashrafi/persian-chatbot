import React, { useEffect, useRef, useState } from 'react';
import { StarIcon } from './Icons.jsx';

const STEPS = [
  {
    title: 'به «یار برنامه‌نویس» خوش اومدی',
    body: 'یه چت‌بات فارسیه که درباره‌ی برنامه‌نویسی، پایتون و هوش مصنوعی جواب می‌ده. ولی یه چیز ویژه داره: می‌تونی ببینی خودش چطور کار می‌کنه.',
    tip: 'این تور فقط ۴ قدمه و کمتر از یه دقیقه طول می‌کشه.',
  },
  {
    title: 'قدم اول: یه سوال بپرس',
    body: 'یکی از سوال‌های پیشنهادی رو بزن، یا سوال خودت رو پایین بنویس. با Enter ارسال می‌شه و با Shift + Enter خط جدید می‌گیری.',
    tip: 'سوال‌ها لازم نیست کامل باشن. ساده بپرس.',
  },
  {
    title: 'قدم دوم: حالت آموزشی رو روشن کن',
    body: 'کلید «حالت آموزشی» زیر عنوان صفحه‌ست. وقتی روشنه، زیر هر جواب یه بخش «پشت صحنه» می‌بینی: پیامت چه مسیری رفت و چه کسی چه کاری کرد.',
    tip: 'اسم فایلی که هر مرحله توش نوشته شده هم کنار هر قدم هست.',
  },
  {
    title: 'قدم سوم: خودت بازش کن',
    body: 'کد این پروژه ساده و خوندنیه. اگه می‌خوای یاد بگیری، پشت صحنه رو ببین، بعد فایلی که اسمش نوشته شده رو باز کن و تغییرش بده.',
    tip: 'هر وقت گیج شدی، دکمه‌ی «؟» بالای صفحه همین تور رو دوباره نشون می‌ده.',
  },
];

export default function Tour({ onClose }) {
  const [step, setStep] = useState(0);
  const primaryRef = useRef(null);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  useEffect(() => {
    primaryRef.current && primaryRef.current.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tour-backdrop" role="presentation" onClick={onClose}>
      <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" onClick={(e) => e.stopPropagation()}>
        <div className="tour-badge" aria-hidden="true">
          <StarIcon />
        </div>
        <p className="tour-count">
          قدم {step + 1} از {STEPS.length}
        </p>
        <h2 id="tour-title">{s.title}</h2>
        <p className="tour-body">{s.body}</p>
        <p className="tour-tip">{s.tip}</p>

        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>

        <div className="tour-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            رد کردن
          </button>
          <span className="spacer" />
          {step > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
              قبلی
            </button>
          )}
          <button ref={primaryRef} type="button" className="btn-primary" onClick={() => (last ? onClose() : setStep(step + 1))}>
            {last ? 'شروع کنیم' : 'بعدی'}
          </button>
        </div>
      </div>
    </div>
  );
}
