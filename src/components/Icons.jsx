import React from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

// ستاره‌ی هشت‌پر: دو مربع روی هم (الهام‌گرفته از نقش‌های هندسی ایرانی)
export function StarIcon(props) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="7" y="7" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="18" height="18" rx="2" transform="rotate(45 16 16)" />
    </svg>
  );
}

// فلش ارسال: توی صفحه‌ی راست‌چین «جلو» یعنی سمت چپ
export const SendIcon = (p) => (
  <svg {...base} strokeWidth={2.2} {...p}>
    <path d="M20 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </svg>
);
export const ResetIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);
export const HelpIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 3.8" />
    <path d="M12 17.6h.01" />
  </svg>
);
export const MoonIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
export const SunIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const StopIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
