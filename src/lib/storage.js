// ذخیره‌ی تنظیمات کوچیک (مثل روشن بودن حالت آموزشی) توی مرورگر.
// اگه مرورگر اجازه نده، برنامه بدون ذخیره‌سازی کار می‌کنه.
const PREFIX = 'yar-bot:';

export function loadPref(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function savePref(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* مهم نیست */
  }
}
