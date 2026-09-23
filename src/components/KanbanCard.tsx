import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../db/repo';
import { dragState } from '../lib/dndState';
import { AlignLeftIcon } from './Icons';

/** 卡片外观（DragOverlay 中复用以渲染拖拽跟随效果） */
export function CardFace({ card, className = '' }: { card: Card; className?: string }) {
  return (
    <div className={`rounded-lg bg-white shadow-sm ${className}`}>
      <p className="break-words p-2.5 text-sm leading-relaxed text-slate-800">{card.title}</p>
      {card.description.trim() !== '' && (
        <div className="px-2.5 pb-2 text-slate-400">
          <AlignLeftIcon className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

interface KanbanCardProps {
  card: Card;
  onOpen: () => void;
}

export default function KanbanCard({ card, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => {
        // 拖拽刚结束时浏览器仍会派发 click，短暂抑制避免误开弹窗
        if (Date.now() - dragState.lastDragEndedAt < 200) return;
        onOpen();
      }}
      className={`touch-none cursor-grab select-none rounded-lg ring-1 transition-[box-shadow,ring-color] active:cursor-grabbing ${
        isDragging ? 'opacity-40 ring-slate-300' : 'ring-slate-200 hover:ring-sky-400'
      }`}
    >
      <CardFace card={card} />
    </div>
  );
}
