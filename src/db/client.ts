import type { SqlValue } from 'sql.js';
import type { DbRequest, DbWorkerMessage } from './protocol';

export const dbWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

interface Pending {
  resolve: (rows: Record<string, SqlValue>[]) => void;
  reject: (error: Error) => void;
}

const pending = new Map<number, Pending>();
let nextId = 1;
let fatal: Error | null = null;

dbWorker.onmessage = (event: MessageEvent<DbWorkerMessage>) => {
  const message = event.data;
  // DbFatal 没有 id 字段，以此区分两种消息
  if (!('id' in message)) {
    fatal = new Error(message.error);
    for (const entry of pending.values()) {
      entry.reject(fatal);
    }
    pending.clear();
    return;
  }
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.ok) {
    entry.resolve(message.rows ?? []);
  } else {
    entry.reject(new Error(message.error ?? '数据库操作失败'));
  }
};

function request(payload: Omit<DbRequest, 'id'>): Promise<Record<string, SqlValue>[]> {
  if (fatal) return Promise.reject(fatal);
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    dbWorker.postMessage({ ...payload, id });
  });
}

export function dbQuery<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  return request({ type: 'query', sql, params }) as Promise<T[]>;
}

export function dbExec(sql: string, params: SqlValue[] = []): Promise<void> {
  return request({ type: 'exec', sql, params }).then(() => undefined);
}

export async function dbBatch(ops: DbRequest['ops']): Promise<void> {
  if (!ops || ops.length === 0) return;
  await request({ type: 'batch', ops });
}

export function getFatalError(): Error | null {
  return fatal;
}
