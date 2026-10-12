import React from 'react';
import Markdown from './Markdown.jsx';
import BehindScenes from './BehindScenes.jsx';

export default function Message({ m, edu, firstBot, onRetry }) {
  if (m.role === 'user') {
    return <div className="msg user">{m.content}</div>;
  }

  const waiting = m.streaming && !m.content;

  return (
    <div className="bot-wrap">
      <div className={`msg bot${m.error ? ' has-error' : ''}`}>
        {waiting && (
          <span className="dots" role="status" aria-label="در حال نوشتن">
            <i />
            <i />
            <i />
          </span>
        )}
        {m.content && <Markdown text={m.content} />}
        {m.error && (
          <div className="error-note" role="alert">
            <span>{m.error}</span>
            {onRetry && (
              <button type="button" className="btn-mini" onClick={() => onRetry(m.id)}>
                دوباره امتحان کن
              </button>
            )}
          </div>
        )}
      </div>
      {edu && <BehindScenes debug={m.debug} streaming={m.streaming} defaultOpen={firstBot} />}
    </div>
  );
}
