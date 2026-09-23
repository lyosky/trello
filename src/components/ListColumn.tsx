import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, KanbanList } from '../db/repo';
import type { KanbanApi } from '../hooks/useKanban';
import CardComposer from './CardComposer';
import EditableText from './EditableText';
import { TrashIcon } from './Icons';
import KanbanCard from './KanbanCard';

interface ListColumnProps {
  list: KanbanList;
  cards: Card[];
  api: KanbanApi;
}

/** 一列：整列既是可拖拽排序列（拖拽手柄在头部），也是卡片的放置容器（空列也能接收卡片） */
export default function ListColumn({ list, cards, api }: ListColumnProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: 'list' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-slate-100/95 shadow-sm ring-1 ring-slate-900/5 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <header
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex cursor-grab touch-none select-none items-center gap-1.5 px-3 pt-2.5 pb-1"
        title="拖动移动列表"
      >
        <EditableText
          value={list.title}
          onCommit={(title) => api.renameList(list.id, title)}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700"
          inputClassName="min-w-0 flex-1 rounded border border-sky-400 px-1 py-0.5 text-sm font-semibold text-slate-700 outline-none"
        />
        <span className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 text-xs font-medium text-slate-500">
          {cards.length}
        </span>
        <button
          className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-600"
          title="删除列表"
          onClick={(event) => {
            event.stopPropagation();
            if (window.confirm(`删除列表「${list.title}」及其中的 ${cards.length} 张卡片？`)) {
              api.deleteList(list.id);
            }
          }}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="nice-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-1">
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} onOpen={() => api.openCard(card.id)} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-slate-300/70 p-3 text-center text-xs text-slate-400">
            拖动卡片到这里
          </div>
        )}
      </div>

      <div className="pb-1.5">
        <CardComposer onCreate={(title) => api.createCard(list.id, title)} />
      </div>
    </div>
  );
}
