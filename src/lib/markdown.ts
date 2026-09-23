import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Markdown -> 消毒后的 HTML。
 * - GFM：表格、删除线、任务列表、自动链接
 * - breaks：单个换行渲染为 <br>（对随手写的描述更友好）
 * - DOMPurify 消毒，防止描述中的脚本 / 事件属性 XSS
 */
export function renderMarkdown(source: string): string {
  if (!source.trim()) return '';
  const html = marked.parse(source, { async: false, breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}
