import type { DocMeta } from '@collab/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CLOSE_NORMAL } from '../collab/protocol.js';
import { RoomManager } from '../collab/room-manager.js';
import type { DocumentRow } from '../db/database.js';
import { DbService } from '../db/database.js';
import { newId, nowIso } from '../utils/ids.js';

function toDocMeta(row: DocumentRow): DocMeta {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class DocsService {
  constructor(
    @Inject(DbService) private readonly db: DbService,
    @Inject(RoomManager) private readonly roomManager: RoomManager,
  ) {}

  list(): DocMeta[] {
    return this.db.db
      .prepare<[], DocumentRow>(
        'SELECT * FROM documents ORDER BY updated_at DESC',
      )
      .all()
      .map(toDocMeta);
  }

  create(ownerId: number, title?: string): DocMeta {
    const id = newId();
    const now = nowIso();
    this.db.db
      .prepare(
        'INSERT INTO documents (id, title, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, title?.trim() || '未命名文档', ownerId, now, now);
    // 空文档：y_state 保持 NULL，首次连接时以空文档重建
    return this.get(id);
  }

  get(id: string): DocMeta {
    const row = this.db.db
      .prepare<[string], DocumentRow>('SELECT * FROM documents WHERE id = ?')
      .get(id);
    if (!row) {
      throw new HttpException({ message: '文档不存在' }, 404);
    }
    return toDocMeta(row);
  }

  update(id: string, title?: string): DocMeta {
    const existing = this.get(id);
    const nextTitle = title?.trim() || existing.title;
    this.db.db
      .prepare('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?')
      .run(nextTitle, nowIso(), id);
    return this.get(id);
  }

  /** 删除文档：事务内删文档+评论；关闭房间全部连接（code 1000）并逐出。 */
  remove(id: string): void {
    this.get(id); // 不存在则 404
    this.db.db.transaction(() => {
      this.db.db.prepare('DELETE FROM comments WHERE doc_id = ?').run(id);
      this.db.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    })();
    this.roomManager.closeRoom(id, CLOSE_NORMAL);
  }
}
