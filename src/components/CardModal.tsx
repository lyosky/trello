import { useEffect, useState } from 'react';
import type { Card } from '../db/repo';
import MarkdownView from './MarkdownView';
import { AlignLeftIcon, TrashIcon, XIcon } from './Icons';

interface CardModalProps {
  card: Card;
  listTitle: string;
  onSave: (patch: { title?: string; description?: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}

type DescMode = 'edit' | 'preview';

/** 卡片详情弹窗：编辑标题、Markdown 描述（编辑/预览）、删除 */
export default function CardModal({ card, listTitle, onSave, onDelete, onClose }: CardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [descMode, setDescMode] = useState<DescMode>('edit');

  // 打开的是另一张卡片时重置草稿
  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description);
    setDescMode('edit');
  }, [card.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== card.title) {
      onSave({ title: trimmed });
    } else {
      setTitle(card.title);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="nice-scroll w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold text-slate-800 outline-none transition-colors hover:border-slate-200 focus:border-sky-400"
            placeholder="卡片标题"
          />
          <button
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            title="关闭（Esc）"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-0.5 px-2 text-xs text-slate-400">
          在列表「{listTitle}」中 · 创建于 {new Date(card.created_at).toLocaleString('zh-CN')}
        </p>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500">
              <AlignLeftIcon className="h-3.5 w-3.5" />
              描述（支持 Markdown）
            </div>
            <div className="flex rounded-md bg-slate-100 p-0.5 text-xs">
              <button
                className={`rounded px-2 py-0.5 transition-colors ${
                  descMode === 'edit' ? 'bg-white font-medium text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setDescMode('edit')}
              >
                编辑
              </button>
              <button
                className={`rounded px-2 py-0.5 transition-colors ${
                  descMode === 'preview' ? 'bg-white font-medium text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setDescMode('preview')}
              >
                预览
              </button>
            </div>
          </div>

          {descMode === 'edit' ? (
            <textarea
              value={description}
              rows={5}
              placeholder="添加更详细的描述，支持 Markdown 语法…"
              className="nice-scroll w-full resize-y rounded-lg border border-slate-200 p-3 font-mono text-sm leading-relaxed text-slate-700 outline-none transition-colors focus:border-sky-400"
              onChange={(event) => setDescription(event.target.value)}
            />
          ) : (
            <div
              className="nice-scroll min-h-20 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
              onClick={() => description.trim() === '' && setDescMode('edit')}
            >
              {description.trim() === '' ? (
                <p className="cursor-text text-sm text-slate-400">暂无描述，点击切换到编辑</p>
              ) : (
                <MarkdownView source={description} />
              )}
            </div>
          )}

          <div className="mt-1.5 flex gap-1.5">
            <button
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-default disabled:opacity-40"
              disabled={description === card.description}
              onClick={() => onSave({ description })}
            >
              保存
            </button>
            {descMode === 'preview' && description !== card.description && (
              <span className="flex items-center px-1 text-xs text-amber-600">预览的是未保存的草稿</span>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-3">
          <button
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-rose-600 transition-colors hover:bg-rose-50"
            onClick={() => {
              if (window.confirm('删除这张卡片？')) onDelete();
            }}
          >
            <TrashIcon className="h-4 w-4" />
            删除卡片
          </button>
        </div>
      </div>
    </div>
  );
}
