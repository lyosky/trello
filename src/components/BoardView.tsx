import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { Card, KanbanList } from '../db/repo';
import type { KanbanApi } from '../hooks/useKanban';
import { dragState } from '../lib/dndState';
import { CardFace } from './KanbanCard';
import ListColumn from './ListColumn';
import ListComposer from './ListComposer';

/**
 * 拖列表时只与其他列表碰撞（避免“列落在卡片上”造成的误排序）；
 * 拖卡片时卡片与列表容器都可以作为目标（closestCorners 对空列也友好）。
 */
const collisionDetection: CollisionDetection = (args) => {
  if (args.active.data.current?.type === 'list') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.type === 'list',
      ),
    });
  }
  return closestCorners(args);
};

interface BoardViewProps {
  api: KanbanApi;
}

export default function BoardView({ api }: BoardViewProps) {
  const { lists, cards, cardsByList } = api;
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeList, setActiveList] = useState<KanbanList | null>(null);
  const originListIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findCard = (id: string): Card | undefined => cards.find((card) => card.id === id);
  const findList = (id: string): KanbanList | undefined => lists.find((list) => list.id === id);

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === 'card') {
      const card = findCard(String(event.active.id));
      setActiveCard(card ?? null);
      originListIdRef.current = card?.list_id ?? null;
    } else if (type === 'list') {
      setActiveList(findList(String(event.active.id)) ?? null);
    }
  };

  /**
   * 拖拽经过目标时实时重排本地状态：
   * - 卡片：跨列移动 / 列内换位（insertAt 为“目标列表当前顺序中 over 的下标”，
   *   moveCardLocal 内部会先移除被拖卡片再按下标插入，与 arrayMove 语义一致）
   * - 列表：仅在列表之间换位
   */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || over.id === active.id) return;
    const activeType = active.data.current?.type;

    if (activeType === 'card') {
      const dragged = findCard(String(active.id));
      if (!dragged) return;

      let targetListId: string;
      let insertAt: number;
      if (over.data.current?.type === 'card') {
        const overCard = findCard(String(over.id));
        if (!overCard) return;
        targetListId = overCard.list_id;
        insertAt = (cardsByList.get(targetListId) ?? []).findIndex((card) => card.id === overCard.id);
      } else {
        // 悬停在列表本体（空列或列内空白区域）→ 追加到末尾
        targetListId = String(over.id);
        const targetCards = cardsByList.get(targetListId) ?? [];
        insertAt = targetCards.length;
        if (targetListId === dragged.list_id && insertAt === targetCards.length) {
          const activeIndex = targetCards.findIndex((card) => card.id === dragged.id);
          if (activeIndex === targetCards.length - 1) return; // 已在末尾，无需处理
        }
      }
      api.moveCardLocal(String(active.id), targetListId, insertAt);
    } else if (activeType === 'list') {
      if (over.data.current?.type !== 'list') return;
      const overIndex = lists.findIndex((list) => list.id === over.id);
      if (overIndex < 0) return;
      api.moveListLocal(String(active.id), overIndex);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    setActiveList(null);
    dragState.lastDragEndedAt = Date.now();

    const type = active.data.current?.type;
    if (type === 'card') {
      const originListId = originListIdRef.current;
      originListIdRef.current = null;
      if (!over || !originListId) {
        api.revertDrag();
        return;
      }
      api.commitCardMove(String(active.id), originListId);
    } else if (type === 'list') {
      if (!over) {
        api.revertDrag();
        return;
      }
      api.commitListMove();
    }
  };

  const handleDragCancel = () => {
    setActiveCard(null);
    setActiveList(null);
    api.revertDrag();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="nice-scroll h-full overflow-x-auto">
        <div className="flex h-full items-start gap-3 p-4">
          <SortableContext items={lists.map((list) => list.id)} strategy={horizontalListSortingStrategy}>
            {lists.map((list) => (
              <ListColumn key={list.id} list={list} cards={cardsByList.get(list.id) ?? []} api={api} />
            ))}
          </SortableContext>
          <ListComposer onCreate={api.createList} />
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeCard && (
          <CardFace card={activeCard} className="w-64 rotate-3 shadow-2xl ring-2 ring-sky-400/70" />
        )}
        {activeList && (
          <div className="w-72 rotate-2 rounded-xl bg-slate-100 p-2 shadow-2xl ring-2 ring-sky-400/70">
            <p className="px-1 pb-2 text-sm font-semibold text-slate-700">{activeList.title}</p>
            {(cardsByList.get(activeList.id) ?? []).slice(0, 3).map((card) => (
              <CardFace key={card.id} card={card} className="mb-2" />
            ))}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
