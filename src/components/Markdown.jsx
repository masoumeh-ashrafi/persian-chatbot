import React from 'react';

// نمایش امن Markdown ساده (بولد، کد، لیست، بلوک کد).
// از innerHTML استفاده نمی‌کنیم؛ همه‌چیز المان React می‌شه، پس تزریق کد ممکن نیست.

function renderInline(text, keyPrefix) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).flatMap((part, i) => {
    if (!part) return [];
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return [<code key={key}>{part.slice(1, -1)}</code>];
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return [<strong key={key}>{part.slice(2, -2)}</strong>];
    }
    return part.split('\n').flatMap((line, j) => (j === 0 ? [line] : [<br key={`${key}-br${j}`} />, line]));
  });
}

function renderBlocks(segment, keyPrefix) {
  const out = [];
  let para = [];
  let list = null; // { type, items }
  const flushPara = () => {
    if (para.length) {
      out.push(<p key={`${keyPrefix}-p${out.length}`}>{renderInline(para.join('\n'), `${keyPrefix}-pi${out.length}`)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const Tag = list.type;
      out.push(
        <Tag key={`${keyPrefix}-l${out.length}`}>
          {list.items.map((item, i) => (
            <li key={i}>{renderInline(item, `${keyPrefix}-li${out.length}-${i}`)}</li>
          ))}
        </Tag>
      );
      list = null;
    }
  };

  segment.split('\n').forEach((line) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const number = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (bullet || number) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet || number)[1]);
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  });
  flushPara();
  flushList();
  return out;
}

export default function Markdown({ text }) {
  const segments = text.split('```');
  return (
    <>
      {segments.map((seg, i) => {
        if (i % 2 === 1) {
          // اولین خط بعد از ``` اسم زبانه (مثلاً python)؛ حذفش می‌کنیم
          const code = seg.replace(/^[^\n]*\n/, '').replace(/\n$/, '');
          return (
            <pre key={i} dir="ltr">
              <code>{code}</code>
            </pre>
          );
        }
        return <React.Fragment key={i}>{renderBlocks(seg, `s${i}`)}</React.Fragment>;
      })}
    </>
  );
}
