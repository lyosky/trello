import { useState } from 'react';
import type { KanbanApi } from '../hooks/useKanban';
import EditableText from './EditableText';
import { BoardIcon, CheckIcon, PlusIcon, TrashIcon } from './Icons';

interface TopBarProps {
  api: KanbanApi;
}

export default function TopBar({ api }: TopBarProps) {
  const { boards, currentBoard } = api;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const submitCreate = () => {
    if (!title.trim()) return;
    api.createBoard(title.trim());
    setTitle('');
    setCreating(false);
  };

  return (
    <header className="z-10 flex h-14 shrink-0 items-center gap-3 bg-sky-800 px-4 text-white shadow-md">
      <div className="flex items-center gap-2 font-bold tracking-wide">
        <BoardIcon className="h-5 w-5" />
        <span className="hidden sm:inline">看板</span>
      </div>

      <select
        value={currentBoard?.id ?? ''}
        onChange={(event) => api.selectBoard(event.target.value)}
        className="max-w-56 cursor-pointer truncate rounded-md bg-sky-700/70 px-2 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-sky-700"
        title="切换看板"
      >
        {boards.length === 0 && <option value="">（暂无看板）</option>}
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.title}
          </option>
        ))}
      </select>

      {creating ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={title}
            placeholder="新看板名称…"
            className="w-44 rounded-md bg-white/95 px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitCreate();
              } else if (event.key === 'Escape') {
                setCreating(false);
                setTitle('');
              }
            }}
          />
          <button
            className="rounded-md bg-emerald-500 p-1.5 transition-colors hover:bg-emerald-600"
            onClick={submitCreate}
            title="创建看板"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          className="flex items-center gap-1 rounded-md bg-sky-700/70 px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-sky-700"
          onClick={() => setCreating(true)}
        >
          <PlusIcon className="h-4 w-4" />
          新建看板
        </button>
      )}

      <div className="flex-1" />

      {currentBoard && (
        <>
          <span className="hidden text-xs text-sky-100/70 lg:inline">点击重命名</span>
          <EditableText
            value={currentBoard.title}
            onCommit={(value) => api.renameBoard(currentBoard.id, value)}
            className="max-w-48 truncate rounded px-2 py-1 text-sm font-semibold hover:bg-white/10"
            inputClassName="w-44 rounded bg-white/95 px-2 py-1 text-sm font-semibold text-slate-800 outline-none"
          />
          <button
            className="rounded-md p-1.5 text-sky-100/80 transition-colors hover:bg-rose-500/80 hover:text-white"
            title="删除当前看板"
            onClick={() => {
              if (window.confirm(`删除看板「${currentBoard.title}」及其全部列表与卡片？`)) {
                api.deleteBoard(currentBoard.id);
              }
            }}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </>
      )}
    </header>
  );
}
