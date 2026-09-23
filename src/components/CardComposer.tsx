import { useRef, useState } from 'react';
import { PlusIcon, XIcon } from './Icons';

interface CardComposerProps {
  onCreate: (title: string) => void;
}

/** 列底部的“添加卡片”表单：提交后保持打开，便于连续添加 */
export default function CardComposer({ onCreate }: CardComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!title.trim()) return;
    onCreate(title.trim());
    setTitle('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const close = () => {
    setOpen(false);
    setTitle('');
  };

  if (!open) {
    return (
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="h-4 w-4" />
        添加卡片
      </button>
    );
  }

  return (
    <div className="px-2 pb-2">
      <textarea
        ref={textareaRef}
        autoFocus
        rows={2}
        value={title}
        placeholder="输入卡片标题…"
        className="nice-scroll w-full resize-none rounded-lg border-2 border-sky-400 bg-white p-2 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          } else if (event.key === 'Escape') {
            close();
          }
        }}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
          onClick={submit}
        >
          添加
        </button>
        <button
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70"
          onClick={close}
          title="关闭"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
