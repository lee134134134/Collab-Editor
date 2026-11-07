import type {
  CommentActivityEvent,
  CommentAnchor,
  CommentDTO,
} from '@collab/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { RoomManager } from '../collab/room-manager.js';
import type { AppConfig } from '../config.js';
import { CONFIG } from '../config.js';
import type { CommentRow } from '../db/database.js';
import { DbService } from '../db/database.js';
import { newId, nowIso } from '../utils/ids.js';

/** comments JOIN users 的行结构（author 平铺进 DTO）。 */
interface CommentJoinedRow extends CommentRow {
  username: string;
  display_name: string;
  color: string;
}

/** 解析 anchor JSON，非法则返回 null（防御性兜底）。 */
function parseAnchor(anchor: string | null): CommentAnchor | null {
  if (!anchor) return null;
  try {
    return JSON.parse(anchor) as CommentAnchor;
  } catch {
    return null;
  }
}

function toCommentDTO(row: CommentJoinedRow): CommentDTO {
  return {
    id: row.id,
    docId: row.doc_id,
    author: {
      id: row.author_id,
      username: row.username,
      displayName: row.display_name,
      color: row.color ?? '#f0883e',
    },
    content: row.content,
    anchor: parseAnchor(row.anchor),
    parentId: row.parent_id,
    resolved: row.resolved === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_JOINED = `
  SELECT c.id, c.doc_id, c.author_id, c.content, c.anchor, c.parent_id, c.resolved,
         c.created_at, c.updated_at, u.username, u.display_name, u.color
  FROM comments c
  JOIN users u ON u.id = c.author_id
`;

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DbService) private readonly db: DbService,
    @Inject(RoomManager) private readonly roomManager: RoomManager,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  list(docId: string): CommentDTO[] {
    return this.db.db
      .prepare<[string], CommentJoinedRow>(
        `${SELECT_JOINED} WHERE c.doc_id = ? ORDER BY c.created_at ASC`,
      )
      .all(docId)
      .map(toCommentDTO);
  }

  create(
    docId: string,
    authorId: number,
    body: {
      content?: string;
      anchor?: CommentAnchor;
      parentId?: string | null;
    },
  ): CommentDTO {
    const content = body?.content?.trim();
    if (!content) {
      throw new HttpException({ message: '评论内容不能为空' }, 400);
    }
    const doc = this.db.db
      .prepare<[string], { id: string }>(
        'SELECT id FROM documents WHERE id = ?',
      )
      .get(docId);
    if (!doc) {
      throw new HttpException({ message: '文档不存在' }, 404);
    }
    if (body?.parentId) {
      const parent = this.db.db
        .prepare<[string, string], CommentRow>(
          'SELECT * FROM comments WHERE id = ? AND doc_id = ?',
        )
        .get(body.parentId, docId);
      if (!parent || parent.parent_id !== null) {
        throw new HttpException({ message: '回复的评论不存在' }, 400);
      }
    }

    const id = newId();
    const now = nowIso();
    const anchorJson = body.anchor ? JSON.stringify(body.anchor) : null;
    this.db.db
      .prepare(
        'INSERT INTO comments (id, doc_id, author_id, content, anchor, parent_id, resolved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
      )
      .run(
        id,
        docId,
        authorId,
        content,
        anchorJson,
        body.parentId ?? null,
        now,
        now,
      );

    // POST 创建评论不动 Mark：Mark 由客户端本地添加（走 CRDT 通道），这里仅广播 type=100 刷新行数据
    this.roomManager.broadcastCommentActivity(docId, {
      type: 'created',
      commentId: id,
      docId,
    });
    return this.getById(id);
  }

  update(
    commentId: string,
    body: { content?: string; resolved?: boolean },
    currentUser: JwtPayload,
  ): CommentDTO {
    const row = this.getRawComment(commentId);
    const now = nowIso();

    // content 仅作者可改；resolved 任何人可改
    if (body?.content !== undefined && row.author_id !== currentUser.sub) {
      throw new HttpException({ message: '仅评论作者可修改内容' }, 403);
    }

    let content = row.content;
    let resolved = row.resolved;
    if (body?.content !== undefined) content = body.content;
    if (body?.resolved !== undefined) resolved = body.resolved ? 1 : 0;

    this.db.db
      .prepare(
        'UPDATE comments SET content = ?, resolved = ?, updated_at = ? WHERE id = ?',
      )
      .run(content, resolved, now, commentId);

    // 评论 Mark 收口：resolve（true）→ 服务端改权威 ydoc 的 Mark resolved 属性并广播；
    // 取消解决（false）为 demo 简化，仅更新行数据 + 广播，不反解 Mark。
    if (body?.resolved === true) {
      this.roomManager.applyCommentMarkChange(row.doc_id, 'resolve', commentId);
    }

    const event: CommentActivityEvent = {
      type: 'updated',
      commentId,
      docId: row.doc_id,
    };
    this.roomManager.broadcastCommentActivity(row.doc_id, event);
    return this.getById(commentId);
  }

  /** 删除评论（作者或 admin；顶级删除级联删回复），并收口移除对应 Mark。 */
  remove(commentId: string, currentUser: JwtPayload): void {
    const row = this.getRawComment(commentId);
    const isAuthor = row.author_id === currentUser.sub;
    const isAdmin = currentUser.username === this.config.adminUsername;
    if (!isAuthor && !isAdmin) {
      throw new HttpException({ message: '无权删除该评论' }, 403);
    }

    this.db.db.transaction(() => {
      if (row.parent_id === null) {
        // 顶级删除级联删回复
        this.db.db
          .prepare('DELETE FROM comments WHERE parent_id = ?')
          .run(commentId);
      }
      this.db.db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    })();

    // 评论 Mark 收口：delete → 从权威 ydoc 移除该 commentId 的 Mark（update 广播）
    this.roomManager.applyCommentMarkChange(row.doc_id, 'delete', commentId);
    const event: CommentActivityEvent = {
      type: 'deleted',
      commentId,
      docId: row.doc_id,
    };
    this.roomManager.broadcastCommentActivity(row.doc_id, event);
  }

  // ---------------------------------------------------------------- 内部

  private getById(id: string): CommentDTO {
    const row = this.db.db
      .prepare<[string], CommentJoinedRow>(`${SELECT_JOINED} WHERE c.id = ?`)
      .get(id);
    if (!row) {
      throw new HttpException({ message: '评论不存在' }, 404);
    }
    return toCommentDTO(row);
  }

  private getRawComment(id: string): CommentRow {
    const row = this.db.db
      .prepare<[string], CommentRow>('SELECT * FROM comments WHERE id = ?')
      .get(id);
    if (!row) {
      throw new HttpException({ message: '评论不存在' }, 404);
    }
    return row;
  }
}
