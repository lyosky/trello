import { useState } from 'react';
import { PlusIcon, XIcon } from './Icons';

interface ListComposerProps {
  onCreate: (title: string) => void;
}

/** 看板末尾的“添加列表”幽灵列 */
export default function ListComposer({ onCreate }: ListComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onCreate(title.trim());
    setTitle('');
  };

  const close = () => {
    setOpen(false);
    setTitle('');
  };

  if (!open) {
    return (
      <button
        className="w-72 shrink-0 rounded-xl bg-white/45 p-3 text-left text-sm font-medium text-slate-600 ring-1 ring-slate-900/5 transition-colors hover:bg-white/70"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-1.5">
          <PlusIcon className="h-4 w-4" />
          添加列表
        </span>
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 rounded-xl bg-slate-100/95 p-2 ring-1 ring-slate-900/5">
      <input
        autoFocus
        value={title}
        placeholder="输入列表标题…"
        className="w-full rounded-lg border-2 border-sky-400 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
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
          添加列表
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
