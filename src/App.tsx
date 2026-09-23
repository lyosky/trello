import { useState } from 'react';
import BoardView from './components/BoardView';
import CardModal from './components/CardModal';
import { PlusIcon } from './components/Icons';
import TopBar from './components/TopBar';
import { useKanban } from './hooks/useKanban';

export default function App() {
  const api = useKanban();

  if (api.status === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sky-300 border-t-transparent" />
        <p className="text-sm">正在打开数据库…</p>
      </div>
    );
  }

  if (api.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-lg">
          <p className="text-lg font-semibold text-slate-800">无法启动看板</p>
          <p className="mt-2 break-words text-sm leading-relaxed text-slate-500">{api.error}</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            请使用支持 OPFS 的现代浏览器（最新版 Chrome / Edge / Safari），并避免在多个标签页中同时打开本应用。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-sky-100">
      <TopBar api={api} />

      <main className="min-h-0 flex-1">
        {api.currentBoard ? <BoardView api={api} /> : <EmptyBoardState onCreate={api.createBoard} />}
      </main>

      {api.modalCard && (
        <CardModal
          card={api.modalCard}
          listTitle={api.modalCardList?.title ?? ''}
          onSave={(patch) => api.updateCard(api.modalCard!.id, patch)}
          onDelete={() => api.deleteCard(api.modalCard!.id)}
          onClose={api.closeCard}
        />
      )}

      {api.error && (
        <button
          className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg transition-opacity hover:opacity-90"
          onClick={api.clearError}
          role="alert"
        >
          {api.error}
        </button>
      )}
    </div>
  );
}

function EmptyBoardState({ onCreate }: { onCreate: (title: string) => void }) {
  const [title, setTitle] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onCreate(title.trim());
    setTitle('');
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
        <p className="text-lg font-semibold text-slate-800">创建你的第一个看板</p>
        <p className="mt-1 text-sm text-slate-500">看板 → 列表 → 卡片，所有数据都保存在本地浏览器中。</p>
        <div className="mt-4 flex gap-2">
          <input
            value={title}
            placeholder="看板名称，如「产品规划」"
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-sky-400"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
          <button
            className="flex shrink-0 items-center gap-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
            onClick={submit}
          >
            <PlusIcon className="h-4 w-4" />
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
