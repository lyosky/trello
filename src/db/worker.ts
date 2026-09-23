import initSqlJs from 'sql.js';
import type { Database, SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { DbRequest, DbResponse } from './protocol';

/**
 * 数据库 Worker：持有 sql.js 实例，数据库文件持久化在 OPFS
 * （navigator.storage.getDirectory() 下的 trello.sqlite）。
 *
 * 写操作（exec / batch）执行完成后立即整库写回 OPFS：
 * truncate(0) -> write(db.export(), { at: 0 }) -> flush()。
 * 同步句柄只允许在 Worker 中使用，且看板库很小，全量写完全可接受。
 */

const DB_FILE_NAME = 'trello.sqlite';

/** FileSystemSyncAccessHandle 的结构化描述，避免依赖 lib.dom 版本差异 */
interface SyncAccessHandle {
  getSize(): number;
  read(buffer: ArrayBuffer, options?: { at?: number }): number;
  write(buffer: Uint8Array, options?: { at?: number }): number;
  truncate(newSize: number): void;
  flush(): void;
  close(): void;
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
};

let db: Database | null = null;
let fileHandle: SyncAccessHandle | null = null;
let ready = false;

const pendingEvents: MessageEvent[] = [];

ctx.onmessage = (event: MessageEvent) => {
  if (!ready) {
    pendingEvents.push(event);
    return;
  }
  handleRequest(event.data as DbRequest);
};

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function openDatabase(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  const storage = (
    navigator as unknown as {
      storage?: { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
    }
  ).storage;
  if (!storage?.getDirectory) {
    throw new Error('当前浏览器不支持 OPFS 存储');
  }
  const root = await storage.getDirectory();
  const file = await root.getFileHandle(DB_FILE_NAME, { create: true });
  const createSyncAccessHandle = (
    file as unknown as { createSyncAccessHandle?: () => Promise<SyncAccessHandle> }
  ).createSyncAccessHandle;
  if (!createSyncAccessHandle) {
    throw new Error('当前浏览器不支持 OPFS 同步句柄（请在最新版 Chrome / Edge / Safari 中打开）');
  }
  fileHandle = await createSyncAccessHandle.call(file);

  const size = fileHandle.getSize();
  if (size > 0) {
    const buffer = new ArrayBuffer(size);
    fileHandle.read(buffer, { at: 0 });
    db = new SQL.Database(new Uint8Array(buffer));
  } else {
    db = new SQL.Database();
    migrateAndSeed(db);
    persist();
  }
}

function migrateAndSeed(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      position REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      position REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id);
    CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
  `);

  const result = database.exec('SELECT COUNT(*) AS n FROM boards');
  const count = Number(result[0]?.values[0]?.[0] ?? 0);
  if (count > 0) return;

  const now = new Date().toISOString();
  const boardId = uid();
  const listIds = { todo: uid(), doing: uid(), done: uid() };
  database.run('INSERT INTO boards (id, title, position, created_at) VALUES (?, ?, ?, ?)', [
    boardId,
    '欢迎看板 🎉',
    1024,
    now,
  ]);
  const lists: Array<[string, string, number]> = [
    [listIds.todo, '📥 待办', 1024],
    [listIds.doing, '🚀 进行中', 2048],
    [listIds.done, '✅ 已完成', 3072],
  ];
  for (const [id, title, position] of lists) {
    database.run('INSERT INTO lists (id, board_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)', [
      id,
      boardId,
      title,
      position,
      now,
    ]);
  }
  const cards: Array<[string, string, string, number]> = [
    [
      listIds.todo,
      '浏览这个看板',
      '这是一个本地优先的看板应用：数据保存在浏览器 OPFS 中的 SQLite 数据库里，完全离线可用，刷新页面也不会丢失。',
      1024,
    ],
    [listIds.todo, '点击卡片可以编辑标题和描述', '', 2048],
    [listIds.todo, '把这张卡片拖到其他列表试试 👉', '', 3072],
    [listIds.doing, '拖拽排序：卡片上下移动、列表左右移动', '', 1024],
    [listIds.done, '创建第一个看板 ✓', '', 1024],
  ];
  for (const [listId, title, description, position] of cards) {
    database.run(
      'INSERT INTO cards (id, list_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uid(), listId, title, description, position, now],
    );
  }
}

function persist(): void {
  if (!db || !fileHandle) return;
  const bytes = db.export();
  fileHandle.truncate(0);
  fileHandle.write(bytes, { at: 0 });
  fileHandle.flush();
}

function runQuery(sql: string, params: SqlValue[]): Record<string, SqlValue>[] {
  const stmt = db!.prepare(sql);
  try {
    stmt.bind(params);
    const rows: Record<string, SqlValue>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, SqlValue>);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function handleRequest(request: DbRequest): void {
  try {
    if (!db) throw new Error('数据库尚未初始化');
    let rows: Record<string, SqlValue>[] | undefined;
    if (request.type === 'query') {
      rows = runQuery(request.sql ?? '', request.params ?? []);
    } else if (request.type === 'exec') {
      db.run(request.sql ?? '', request.params ?? []);
      persist();
    } else if (request.type === 'batch') {
      db.run('BEGIN');
      try {
        for (const op of request.ops ?? []) {
          db.run(op.sql, op.params ?? []);
        }
        db.run('COMMIT');
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
      persist();
    } else {
      throw new Error(`未知请求类型：${String(request.type)}`);
    }
    const response: DbResponse = { id: request.id, ok: true, rows };
    ctx.postMessage(response);
  } catch (err) {
    const response: DbResponse = {
      id: request.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    ctx.postMessage(response);
  }
}

async function boot(): Promise<void> {
  try {
    await openDatabase();
    ready = true;
    for (const event of pendingEvents) {
      handleRequest(event.data as DbRequest);
    }
    pendingEvents.length = 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'fatal', error: `数据库初始化失败：${message}` });
  }
}

void boot();
