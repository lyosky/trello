import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdown } from '../lib/markdown';

interface MarkdownViewProps {
  source: string;
  className?: string;
}

/** Markdown 渲染视图：内容经 DOMPurify 消毒，链接统一新标签页打开 */
export default function MarkdownView({ source, className = '' }: MarkdownViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(source), [source]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const anchor of root.querySelectorAll('a')) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className={`markdown-body nice-scroll ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
