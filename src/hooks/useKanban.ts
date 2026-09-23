import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as repo from '../db/repo';
import type { DbOp } from '../db/protocol';
import type { Board, Card, KanbanList } from '../db/repo';

const CURRENT_BOARD_KEY = 'trello.currentBoardId';

export type KanbanStatus = 'loading' | 'ready' | 'error';

/**
 * 看板应用的全部状态与操作。
 * 普通增删改走「先写库、成功后更新状态」；拖拽走「先改本地状态（乐观预览）、
 * dragEnd 时批量落库」，失败统一提示并从数据库恢复。
 */
export function useKanban() {
  const [status, setStatus] = useState<KanbanStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [lists, setLists] = useState<KanbanList[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [modalCardId, setModalCardId] = useState<string | null>(null);

  const currentBoardIdRef = useRef<string | null>(null);
  const errorTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    currentBoardIdRef.current = currentBoardId;
    if (currentBoardId) {
      localStorage.setItem(CURRENT_BOARD_KEY, currentBoardId);
    } else {
      localStorage.removeItem(CURRENT_BOARD_KEY);
    }
  }, [currentBoardId]);

  const showError = useCallback((message: string) => {
    setError(message);
    window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 4000);
  }, []);

  const clearError = useCallback(() => {
    window.clearTimeout(errorTimer.current);
    setError(null);
  }, []);

  // 初始化：加载看板列表与恢复上次打开的看板
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const allBoards = await repo.listBoards();
        if (cancelled) return;
        setBoards(allBoards);
        const saved = localStorage.getItem(CURRENT_BOARD_KEY);
        const initial = allBoards.find((board) => board.id === saved)?.id ?? allBoards[0]?.id ?? null;
        if (initial) {
          const data = await repo.getBoardData(initial);
          if (cancelled) return;
          setCurrentBoardId(initial);
          setLists(data.lists);
          setCards(data.cards);
        }
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadBoard = useCallback(async (boardId?: string): Promise<void> => {
    const id = boardId ?? currentBoardIdRef.current;
    if (!id) {
      setLists([]);
      setCards([]);
      return;
    }
    const data = await repo.getBoardData(id);
    setLists(data.lists);
    setCards(data.cards);
  }, []);

  /** 执行写操作；失败时提示并从数据库恢复界面状态 */
  const guard = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败，已从数据库恢复');
        try {
          setBoards(await repo.listBoards());
          await reloadBoard();
        } catch {
          // 初始化级失败：保持错误提示即可
        }
      }
    },
    [reloadBoard, showError],
  );

  // ---------- 看板 ----------

  const selectBoard = useCallback(
    (boardId: string) => {
      setCurrentBoardId(boardId);
      setModalCardId(null);
      void (async () => {
        try {
          await reloadBoard(boardId);
        } catch (err) {
          showError(err instanceof Error ? err.message : '切换看板失败');
        }
      })();
    },
    [reloadBoard, showError],
  );

  const createBoard = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      void guard(async () => {
        const board = await repo.createBoard(trimmed);
        setBoards((prev) => [...prev, board]);
        setCurrentBoardId(board.id);
        setLists([]);
        setCards([]);
        setModalCardId(null);
      });
    },
    [guard],
  );

  const renameBoard = useCallback(
    (boardId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setBoards((prev) => prev.map((board) => (board.id === boardId ? { ...board, title: trimmed } : board)));
      void guard(() => repo.renameBoard(boardId, trimmed));
    },
    [guard],
  );

  const deleteBoard = useCallback(
    (boardId: string) => {
      void guard(async () => {
        await repo.deleteBoard(boardId);
        const remaining = await repo.listBoards();
        setBoards(remaining);
        if (currentBoardIdRef.current === boardId) {
          const next = remaining[0]?.id ?? null;
          setCurrentBoardId(next);
          setModalCardId(null);
          await reloadBoard(next);
        }
      });
    },
    [guard, reloadBoard],
  );

  // ---------- 列表 ----------

  const createList = useCallback(
    (title: string) => {
      const boardId = currentBoardIdRef.current;
      const trimmed = title.trim();
      if (!boardId || !trimmed) return;
      void guard(async () => {
        const list = await repo.createList(boardId, trimmed);
        setLists((prev) => [...prev, list]);
      });
    },
    [guard],
  );

  const renameList = useCallback(
    (listId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setLists((prev) => prev.map((list) => (list.id === listId ? { ...list, title: trimmed } : list)));
      void guard(() => repo.renameList(listId, trimmed));
    },
    [guard],
  );

  const deleteList = useCallback(
    (listId: string) => {
      setLists((prev) => prev.filter((list) => list.id !== listId));
      setCards((prev) => prev.filter((card) => card.list_id !== listId));
      void guard(async () => {
        await repo.deleteList(listId);
      });
    },
    [guard],
  );

  /** 拖拽预览：列表移动到某个位置（“移除后在第 insertAt 位插入”语义） */
  const moveListLocal = useCallback((listId: string, insertAt: number) => {
    setLists((prev) => {
      const from = prev.findIndex((list) => list.id === listId);
      if (from < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, moved);
      return next;
    });
  }, []);

  /** dragEnd：把当前列表顺序落库 */
  const commitListMove = useCallback(() => {
    const ops = repo.listLayoutOps(lists.map((list) => list.id));
    void guard(() => repo.persistOps(ops));
  }, [guard, lists]);

  // ---------- 卡片 ----------

  /**
   * 拖拽预览：把卡片移动到 toListId 的第 insertAt 个位置（“移除后插入”语义）。
   * 位置取相邻两张卡片 position 的中点，仅用于界面排序，dragEnd 时统一重编号。
   */
  const moveCardLocal = useCallback((cardId: string, toListId: string, insertAt: number) => {
    setCards((prev) => {
      const card = prev.find((item) => item.id === cardId);
      if (!card) return prev;
      const target = prev
        .filter((item) => item.list_id === toListId)
        .sort((a, b) => a.position - b.position);
      const without = target.filter((item) => item.id !== cardId);
      const index = Math.max(0, Math.min(insertAt, without.length));
      const before = index > 0 ? without[index - 1].position : 0;
      const after = index < without.length ? without[index].position : before + 2 * repo.GAP;
      const position = (before + after) / 2;
      if (card.list_id === toListId && card.position === position) return prev;
      return prev.map((item) => (item.id === cardId ? { ...item, list_id: toListId, position } : item));
    });
  }, []);

  /** dragEnd：把卡片所在目标列表（以及来源列表）的最终顺序落库 */
  const commitCardMove = useCallback(
    (cardId: string, originListId: string) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card) return;
      const affected = new Set([originListId, card.list_id]);
      const ops: DbOp[] = [];
      for (const listId of affected) {
        const ordered = cards
          .filter((item) => item.list_id === listId)
          .sort((a, b) => a.position - b.position)
          .map((item) => item.id);
        ops.push(...repo.cardLayoutOps(listId, ordered));
      }
      void guard(() => repo.persistOps(ops));
    },
    [cards, guard],
  );

  /** 拖拽取消 / 落在无效位置：从数据库恢复，丢弃预览 */
  const revertDrag = useCallback(() => {
    void (async () => {
      try {
        await reloadBoard();
      } catch {
        // 恢复失败时保持现状，下一次操作仍会落库
      }
    })();
  }, [reloadBoard]);

  const createCard = useCallback(
    (listId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      void guard(async () => {
        const card = await repo.createCard(listId, trimmed);
        setCards((prev) => [...prev, card]);
      });
    },
    [guard],
  );

  const updateCard = useCallback(
    (cardId: string, patch: { title?: string; description?: string }) => {
      const trimmedPatch: { title?: string; description?: string } = {};
      if (patch.title !== undefined) {
        const trimmed = patch.title.trim();
        if (!trimmed) return;
        trimmedPatch.title = trimmed;
      }
      if (patch.description !== undefined) trimmedPatch.description = patch.description;
      setCards((prev) => prev.map((card) => (card.id === cardId ? { ...card, ...trimmedPatch } : card)));
      void guard(() => repo.updateCard(cardId, trimmedPatch));
    },
    [guard],
  );

  const deleteCard = useCallback(
    (cardId: string) => {
      setCards((prev) => prev.filter((card) => card.id !== cardId));
      setModalCardId((prev) => (prev === cardId ? null : prev));
      void guard(() => repo.deleteCard(cardId));
    },
    [guard],
  );

  const openCard = useCallback((cardId: string) => setModalCardId(cardId), []);
  const closeCard = useCallback(() => setModalCardId(null), []);

  // ---------- 派生数据 ----------

  const currentBoard = useMemo(
    () => boards.find((board) => board.id === currentBoardId) ?? null,
    [boards, currentBoardId],
  );

  const cardsByList = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const list of lists) map.set(list.id, []);
    for (const card of [...cards].sort((a, b) => a.position - b.position)) {
      const bucket = map.get(card.list_id);
      if (bucket) bucket.push(card);
    }
    return map;
  }, [lists, cards]);

  const modalCard = useMemo(() => cards.find((card) => card.id === modalCardId) ?? null, [cards, modalCardId]);

  const modalCardList = useMemo(
    () => lists.find((list) => list.id === modalCard?.list_id) ?? null,
    [lists, modalCard],
  );

  return {
    status,
    error,
    boards,
    currentBoard,
    lists,
    cards,
    cardsByList,
    modalCard,
    modalCardList,
    clearError,
    selectBoard,
    createBoard,
    renameBoard,
    deleteBoard,
    createList,
    renameList,
    deleteList,
    moveListLocal,
    commitListMove,
    moveCardLocal,
    commitCardMove,
    revertDrag,
    createCard,
    updateCard,
    deleteCard,
    openCard,
    closeCard,
  };
}

export type KanbanApi = ReturnType<typeof useKanban>;
