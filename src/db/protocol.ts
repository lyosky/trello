import type { SqlValue } from 'sql.js';

/** 一条待执行的 SQL（可带参数） */
export interface DbOp {
  sql: string;
  params?: SqlValue[];
}

/** 主线程 -> Worker 请求 */
export interface DbRequest {
  id: number;
  type: 'query' | 'exec' | 'batch';
  sql?: string;
  params?: SqlValue[];
  ops?: DbOp[];
}

/** Worker -> 主线程：请求结果 */
export interface DbResponse {
  id: number;
  ok: boolean;
  rows?: Record<string, SqlValue>[];
  error?: string;
}

/** Worker -> 主线程：初始化失败（OPFS 不可用等），此后所有请求都会失败 */
export interface DbFatal {
  type: 'fatal';
  error: string;
}

export type DbWorkerMessage = DbResponse | DbFatal;
