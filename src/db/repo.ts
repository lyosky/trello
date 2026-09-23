import { dbBatch, dbExec, dbQuery } from './client';
import type { DbOp } from './protocol';

export type Board = { id: string; title: string; position: number };
export type KanbanList = { id: string; board_id: string; title: string; position: number };
export type Card = {
  id: string;
  list_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
};

/** 相邻元素的默认位置间隔，重排时按 (index + 1) * GAP 重编号 */
export const GAP = 1024;

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- 读取 ----------

export async function listBoards(): Promise<Board[]> {
  return dbQuery<Board>('SELECT id, title, position FROM boards ORDER BY position');
}

export async function getBoardData(boardId: string): Promise<{ lists: KanbanList[]; cards: Card[] }> {
  const lists = await dbQuery<KanbanList>(
    'SELECT id, board_id, title, position FROM lists WHERE board_id = ? ORDER BY position',
    [boardId],
  );
  if (lists.length === 0) return { lists, cards: [] };
  const placeholders = lists.map(() => '?').join(', ');
  const cards = await dbQuery<Card>(
    `SELECT id, list_id, title, description, position, created_at FROM cards WHERE list_id IN (${placeholders}) ORDER BY position`,
    lists.map((list) => list.id),
  );
  return { lists, cards };
}

// ---------- 写入：看板 ----------

export async function createBoard(title: string): Promise<Board> {
  const rows = await dbQuery<{ maxPos: number | null }>('SELECT MAX(position) AS maxPos FROM boards');
  const board: Board = { id: uid(), title, position: (rows[0]?.maxPos ?? 0) + GAP };
  await dbExec('INSERT INTO boards (id, title, position, created_at) VALUES (?, ?, ?, ?)', [
    board.id,
    board.title,
    board.position,
    new Date().toISOString(),
  ]);
  return board;
}

export async function renameBoard(id: string, title: string): Promise<void> {
  await dbExec('UPDATE boards SET title = ? WHERE id = ?', [title, id]);
}

export async function deleteBoard(id: string): Promise<void> {
  await dbBatch([
    { sql: 'DELETE FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id = ?)', params: [id] },
    { sql: 'DELETE FROM lists WHERE board_id = ?', params: [id] },
    { sql: 'DELETE FROM boards WHERE id = ?', params: [id] },
  ]);
}

// ---------- 写入：列表 ----------

export async function createList(boardId: string, title: string): Promise<KanbanList> {
  const rows = await dbQuery<{ maxPos: number | null }>(
    'SELECT MAX(position) AS maxPos FROM lists WHERE board_id = ?',
    [boardId],
  );
  const list: KanbanList = { id: uid(), board_id: boardId, title, position: (rows[0]?.maxPos ?? 0) + GAP };
  await dbExec('INSERT INTO lists (id, board_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)', [
    list.id,
    list.board_id,
    list.title,
    list.position,
    new Date().toISOString(),
  ]);
  return list;
}

export async function renameList(id: string, title: string): Promise<void> {
  await dbExec('UPDATE lists SET title = ? WHERE id = ?', [title, id]);
}

export async function deleteList(id: string): Promise<void> {
  await dbBatch([
    { sql: 'DELETE FROM cards WHERE list_id = ?', params: [id] },
    { sql: 'DELETE FROM lists WHERE id = ?', params: [id] },
  ]);
}

/** 列表布局：按给定顺序重编号 position */
export function listLayoutOps(orderedListIds: string[]): DbOp[] {
  return orderedListIds.map((listId, index) => ({
    sql: 'UPDATE lists SET position = ? WHERE id = ?',
    params: [(index + 1) * GAP, listId],
  }));
}

// ---------- 写入：卡片 ----------

export async function createCard(listId: string, title: string): Promise<Card> {
  const rows = await dbQuery<{ maxPos: number | null }>(
    'SELECT MAX(position) AS maxPos FROM cards WHERE list_id = ?',
    [listId],
  );
  const card: Card = {
    id: uid(),
    list_id: listId,
    title,
    description: '',
    position: (rows[0]?.maxPos ?? 0) + GAP,
    created_at: new Date().toISOString(),
  };
  await dbExec(
    'INSERT INTO cards (id, list_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [card.id, card.list_id, card.title, card.description, card.position, card.created_at],
  );
  return card;
}

export async function updateCard(id: string, patch: { title?: string; description?: string }): Promise<void> {
  if (patch.title !== undefined) {
    await dbExec('UPDATE cards SET title = ? WHERE id = ?', [patch.title, id]);
  }
  if (patch.description !== undefined) {
    await dbExec('UPDATE cards SET description = ? WHERE id = ?', [patch.description, id]);
  }
}

export async function deleteCard(id: string): Promise<void> {
  await dbExec('DELETE FROM cards WHERE id = ?', [id]);
}

/**
 * 卡片布局：某个列表内的顺序（含可能的跨列表移动）。
 * 同一条 UPDATE 里写入 list_id，跨列表移动与重排一并落库。
 */
export function cardLayoutOps(listId: string, orderedCardIds: string[]): DbOp[] {
  return orderedCardIds.map((cardId, index) => ({
    sql: 'UPDATE cards SET position = ?, list_id = ? WHERE id = ?',
    params: [(index + 1) * GAP, listId, cardId],
  }));
}

export async function persistOps(ops: DbOp[]): Promise<void> {
  await dbBatch(ops);
}
