import type { CommentActivityEvent } from '@collab/shared';
import { WS_MSG_COMMENT_ACTIVITY } from '@collab/shared';
import { Inject, Injectable } from '@nestjs/common';
import * as encoding from 'lib0/encoding';
import { WebSocket } from 'ws';
import type { Awareness } from 'y-protocols/awareness';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import type { DocumentRow } from '../db/database.js';
import { DbService } from '../db/database.js';
import type { Snapshot } from './persistence-queue.js';
import { PersistenceQueue } from './persistence-queue.js';
import {
  CLOSE_NORMAL,
  COMMENT_MARK_NAME,
  EVICT_DELAY_MS,
  MESSAGE_AWARENESS,
  MESSAGE_SYNC,
} from './protocol.js';

/** 评论 Mark 的格式属性结构（与前端契约一致）。 */
export interface CommentMarkAttrs {
  commentId: string;
  resolved: boolean;
}

/** 内存房间：一个 docId 全局唯一实例（单进程单实例硬约束）。 */
export interface Room {
  docId: string;
  /** 权威 Y.Doc（服务端唯一真相源） */
  ydoc: Y.Doc;
  /** 房间级 awareness 状态（协同光标/选区） */
  awareness: Awareness;
  /** 当前连接集合 */
  conns: Set<WebSocket>;
  /** 每条连接引入的 awareness clientId 集合（断开时据此清理） */
  controlledIds: Map<WebSocket, Set<number>>;
  /** 该文档串行落库队列 */
  queue: PersistenceQueue;
  /** 延迟逐出定时器 */
  evictTimer: NodeJS.Timeout | null;
}

/** 遍历 XmlFragment 'default' 下所有文本节点。 */
function walkTextNodes(
  root: Y.AbstractType<any>,
  cb: (text: Y.Text) => void,
): void {
  if (root instanceof Y.Text) {
    cb(root);
    return;
  }
  if (root instanceof Y.XmlFragment || root instanceof Y.XmlElement) {
    for (const child of root.toArray() as Y.AbstractType<any>[]) {
      walkTextNodes(child, cb);
    }
  }
}

/**
 * 遍历权威 ydoc 中所有 comment Mark：对每个带 commentId 的格式段调用 visit。
 * 兼容字符串文本（len=字符数）与 embed（len=1），保证 offset 对齐正确。
 */
export function walkCommentMarks(
  ydoc: Y.Doc,
  visit: (
    text: Y.Text,
    offset: number,
    len: number,
    attrs: CommentMarkAttrs,
  ) => void,
): void {
  walkTextNodes(ydoc.getXmlFragment('default'), (text) => {
    const delta = text.toDelta() as Array<{
      insert?: unknown;
      attributes?: Record<string, unknown>;
    }>;
    let offset = 0;
    for (const d of delta) {
      const len = typeof d.insert === 'string' ? d.insert.length : 1;
      const attr = d.attributes?.[COMMENT_MARK_NAME];
      if (
        attr &&
        typeof attr === 'object' &&
        typeof (attr as CommentMarkAttrs).commentId === 'string'
      ) {
        visit(text, offset, len, attr as CommentMarkAttrs);
      }
      offset += len;
    }
  });
}

/**
 * 房间管理器：协同核心。管理内存权威 Y.Doc 的生命周期、连接引用计数与延迟逐出、
 * 全量快照落库、评论 Mark 服务端收口、开档对账。依赖方向：只 import db 与 yjs 底层，
 * 绝不反向 import docs/comments 模块（避免循环依赖）。
 */
@Injectable()
export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(@Inject(DbService) private readonly db: DbService) {}

  /** 获取房间（不存在则创建），供测试/集成断言。 */
  getRoom(docId: string): Room | undefined {
    return this.rooms.get(docId);
  }

  /**
   * 建立连接引用：get-or-create 房间并登记连接。
   * - 已有房间：取消延迟逐出，复用内存 ydoc（oracle 硬约束 #2：落库期间新连接复用仍驻留的内存房间）。
   * - 不存在：从库载入 y_state 重建 Y.Doc（NULL 则空文档），并做开档对账。
   */
  acquire(docId: string, ws: WebSocket): Room {
    let room = this.rooms.get(docId);
    if (room) {
      if (room.evictTimer) {
        clearTimeout(room.evictTimer);
        room.evictTimer = null;
      }
    } else {
      room = this.createRoom(docId);
      this.rooms.set(docId, room);
    }
    room.conns.add(ws);
    return room;
  }

  /** 移除连接引用：清理 awareness 状态并广播离开；连接归零则挂 30s 延迟逐出。 */
  removeConnection(docId: string, ws: WebSocket): void {
    const room = this.rooms.get(docId);
    if (!room) return;
    const controlled = room.controlledIds.get(ws);
    if (controlled && controlled.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        Array.from(controlled),
        ws,
      );
    }
    room.controlledIds.delete(ws);
    room.conns.delete(ws);
    if (room.conns.size === 0) {
      room.evictTimer = setTimeout(() => this.evict(docId), EVICT_DELAY_MS);
    }
  }

  /** 应用客户端 awareness 更新（协同光标/选区），由 ws-server 调用。 */
  applyAwareness(room: Room, update: Uint8Array, ws: WebSocket): void {
    awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
  }

  /** 向房间广播消息（可排除指定连接）。 */
  broadcast(room: Room, message: Uint8Array, except?: WebSocket): void {
    for (const conn of room.conns) {
      if (conn === except) continue;
      if (conn.readyState === WebSocket.OPEN) {
        try {
          conn.send(message);
        } catch {
          /* 连接已异常，忽略，交由 close 事件清理 */
        }
      }
    }
  }

  /**
   * 评论 Mark 服务端收口（oracle 硬约束 #3）：
   * - resolve：把该 commentId 的 Mark 的 resolved 属性置 true；
   * - delete：按 commentId 移除 Mark。
   * 产生的 update 经 ydoc.on('update') 自动广播到房间（客户端绝不自行改 resolve/delete 的 Mark）。
   */
  applyCommentMarkChange(
    docId: string,
    op: 'resolve' | 'delete',
    commentId: string,
  ): void {
    const room = this.rooms.get(docId);
    if (!room) return;
    this.mutateCommentMark(room.ydoc, op, commentId);
  }

  /** 广播 type=100 评论活动帧（仅用于评论行数据刷新，不承载 Mark 变更）。 */
  broadcastCommentActivity(docId: string, event: CommentActivityEvent): void {
    const room = this.rooms.get(docId);
    if (!room) return;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, WS_MSG_COMMENT_ACTIVITY);
    encoding.writeVarString(enc, JSON.stringify(event));
    this.broadcast(room, encoding.toUint8Array(enc));
  }

  /** 关闭房间全部连接（文档删除时用）并立即逐出 + 最终 flush。 */
  closeRoom(docId: string, code: number = CLOSE_NORMAL): void {
    const room = this.rooms.get(docId);
    if (!room) return;
    if (room.evictTimer) {
      clearTimeout(room.evictTimer);
      room.evictTimer = null;
    }
    for (const conn of Array.from(room.conns)) {
      try {
        conn.close(code);
      } catch {
        /* 忽略 */
      }
    }
    this.evict(docId);
  }

  /** 停机前全量 flush 所有房间。 */
  async flushAll(): Promise<void> {
    const rooms = Array.from(this.rooms.values());
    await Promise.all(rooms.map((r) => r.queue.flushNow()));
  }

  onModuleDestroy(): void {
    void this.flushAll();
    for (const room of this.rooms.values()) {
      room.queue.destroy();
      room.awareness.destroy();
      room.ydoc.destroy();
    }
    this.rooms.clear();
  }

  // ---------------------------------------------------------------- 内部实现

  /** 创建房间：载入 y_state、注册 update/awareness 广播监听、开档对账。 */
  private createRoom(docId: string): Room {
    const ydoc = new Y.Doc();
    // 先载入历史状态（此时尚未注册 update 监听，避免载入被误判为“脏”触发落库）
    const row = this.db.db
      .prepare<[string], DocumentRow>('SELECT * FROM documents WHERE id = ?')
      .get(docId);
    if (row?.y_state) {
      Y.applyUpdate(ydoc, new Uint8Array(row.y_state));
    }

    const room: Room = {
      docId,
      ydoc,
      awareness: new awarenessProtocol.Awareness(ydoc),
      conns: new Set(),
      controlledIds: new Map(),
      queue: new PersistenceQueue(
        () => this.takeSnapshot(ydoc),
        (snapshot) => this.writeSnapshot(docId, snapshot),
      ),
      evictTimer: null,
    };

    // 服务端仅作为 awareness 中继，本身不是在线用户：
    // Awareness 构造器会写入一条空本地状态，并每 ~15s 自动续期触发 update 广播，
    // 不清空会让所有客户端周期性看到一个幽灵「未知用户」。
    room.awareness.setLocalState(null);

    // 权威 ydoc 变更 → 广播其他客户端 + 标记脏数据（oracle 硬约束：绝不差量覆盖）
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      this.broadcast(
        room,
        encoding.toUint8Array(enc),
        origin instanceof WebSocket ? origin : undefined,
      );
      room.queue.markDirty();
    });

    // awareness 变更 → 广播其他客户端，并跟踪每条连接引入的 clientId
    room.awareness.on(
      'update',
      (
        {
          added,
          updated,
          removed,
        }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        if (origin instanceof WebSocket && room.conns.has(origin)) {
          let controlled = room.controlledIds.get(origin);
          if (!controlled) {
            controlled = new Set();
            room.controlledIds.set(origin, controlled);
          }
          for (const id of added) controlled.add(id);
          for (const id of removed) controlled.delete(id);
        }
        const changed = [...added, ...updated, ...removed];
        if (changed.length === 0) return;
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          enc,
          awarenessProtocol.encodeAwarenessUpdate(room.awareness, changed),
        );
        this.broadcast(
          room,
          encoding.toUint8Array(enc),
          origin instanceof WebSocket ? origin : undefined,
        );
      },
    );

    // 开档对账：清理孤儿 Mark + 无 Mark 的锚点置 NULL
    this.reconcile(room);

    return room;
  }

  /** 原子捕获全量快照（update + vector 取自同一状态）。 */
  private takeSnapshot(ydoc: Y.Doc): Snapshot {
    return {
      update: Y.encodeStateAsUpdate(ydoc),
      vector: Y.encodeStateVector(ydoc),
    };
  }

  /** 单事务写全量快照（顺带 updated_at）。 */
  private writeSnapshot(docId: string, snapshot: Snapshot): void {
    const now = new Date().toISOString();
    this.db.db.transaction(() => {
      this.db.db
        .prepare(
          'UPDATE documents SET y_state = ?, y_state_vector = ?, updated_at = ? WHERE id = ?',
        )
        .run(snapshot.update, snapshot.vector, now, docId);
    })();
  }

  /** 在权威 ydoc 上按 commentId 遍历 comment Mark 执行 resolve/delete。 */
  private mutateCommentMark(
    ydoc: Y.Doc,
    op: 'resolve' | 'delete',
    commentId: string,
  ): void {
    ydoc.transact(() => {
      walkCommentMarks(ydoc, (text, offset, len, attrs) => {
        if (attrs.commentId !== commentId) return;
        if (op === 'resolve') {
          text.format(offset, len, {
            [COMMENT_MARK_NAME]: { ...attrs, resolved: true },
          });
        } else {
          text.format(offset, len, { [COMMENT_MARK_NAME]: null });
        }
      });
    });
  }

  /**
   * 开档对账（oracle 硬约束 #4）：
   * 1) 扫描 ydoc 全部 comment Mark 的 commentId，库里不存在的孤儿 Mark 从 ydoc 移除（update 广播）；
   * 2) 库里顶级带 anchor 的评论若 ydoc 无对应 Mark → anchor 置 NULL（保留 quote 供面板展示）；
   * 3) 房间离线期间经 REST 改动的 resolved 状态，回放到权威 ydoc 的 Mark（DB 为 resolved 的真相源）。
   */
  private reconcile(room: Room): void {
    const markIds = new Set<string>();
    walkCommentMarks(room.ydoc, (_text, _offset, _len, attrs) => {
      if (typeof attrs.commentId === 'string') markIds.add(attrs.commentId);
    });

    const rows = this.db.db
      .prepare<
        [string],
        {
          id: string;
          anchor: string | null;
          parent_id: string | null;
          resolved: number;
        }
      >('SELECT id, anchor, parent_id, resolved FROM comments WHERE doc_id = ?')
      .all(room.docId);
    const dbIds = new Set(rows.map((r) => r.id));

    for (const id of markIds) {
      if (!dbIds.has(id)) {
        this.mutateCommentMark(room.ydoc, 'delete', id);
      }
    }

    // resolved 回放：先收集再统一 transact（format 不改变文本长度，offset 稳定）
    const resolvedById = new Map(rows.map((r) => [r.id, r.resolved === 1]));
    const fixes: Array<{
      text: Y.Text;
      offset: number;
      len: number;
      attrs: CommentMarkAttrs;
    }> = [];
    walkCommentMarks(room.ydoc, (text, offset, len, attrs) => {
      const dbResolved = resolvedById.get(attrs.commentId);
      if (dbResolved !== undefined && dbResolved !== attrs.resolved) {
        fixes.push({ text, offset, len, attrs });
      }
    });
    if (fixes.length > 0) {
      room.ydoc.transact(() => {
        for (const f of fixes) {
          const resolved =
            resolvedById.get(f.attrs.commentId) ?? f.attrs.resolved;
          f.text.format(f.offset, f.len, {
            [COMMENT_MARK_NAME]: { ...f.attrs, resolved },
          });
        }
      });
    }

    const clearAnchor = this.db.db.prepare<[null, string]>(
      'UPDATE comments SET anchor = ? WHERE id = ?',
    );
    for (const r of rows) {
      if (r.parent_id === null && r.anchor !== null && !markIds.has(r.id)) {
        clearAnchor.run(null, r.id);
      }
    }
  }

  /** 逐出：最终 flush + 释放资源 + 从 map 移除。 */
  private evict(docId: string): void {
    const room = this.rooms.get(docId);
    if (!room) return;
    this.rooms.delete(docId);
    if (room.evictTimer) {
      clearTimeout(room.evictTimer);
      room.evictTimer = null;
    }
    room.queue.flushNow();
    room.queue.destroy();
    room.awareness.destroy();
    room.ydoc.destroy();
  }
}
