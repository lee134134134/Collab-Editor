import { randomBytes, randomUUID } from 'node:crypto';

/** 生成协同 ticket：32 字节 → 64 位 hex 随机串（一次性、60s 有效）。 */
export function newTicket(): string {
  return randomBytes(32).toString('hex');
}

/** 生成文档/评论主键：UUID v4（TEXT 主键）。 */
export function newId(): string {
  return randomUUID();
}

/** 当前时间 ISO 字符串，统一入库格式。 */
export function nowIso(): string {
  return new Date().toISOString();
}
