import * as decoding from 'lib0/decoding';
import { afterEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import * as Y from 'yjs';
import { RoomManager, walkCommentMarks } from '../src/collab/room-manager.js';
import { TicketService } from '../src/collab/ticket.service.js';
import type { AppConfig } from '../src/config.js';
import { DbService } from '../src/db/database.js';

/** 测试用 AppConfig：内存数据库，避免落盘污染。 */
function makeConfig(): AppConfig {
  return {
    port: 3000,
    wsPort: 3001,
    jwtSecret: 'test-secret',
    dbPath: ':memory:',
    collabAllowedOrigins: ['http://localhost:8001'],
    adminUsername: 'admin',
    adminPassword: 'admin123',
  };
}

/** 内存库 + RoomManager 组合。 */
function makeDb(): DbService {
  return new DbService(makeConfig());
}

/** 最小 ws mock：记录发出的二进制帧，readyState 恒为 OPEN。 */
class MockSocket {
  readyState = 1;
  sent: Uint8Array[] = [];
  send(data: Uint8Array): void {
    this.sent.push(data);
  }
  ping(): void {}
  close(): void {}
  terminate(): void {}
}

function asWebSocket(mock: MockSocket): WebSocket {
  return mock as unknown as WebSocket;
}

/** 从权威 ydoc 读取指定 commentId 的 Mark 的 resolved 属性。 */
function readMarkResolved(ydoc: Y.Doc, commentId: string): boolean | undefined {
  let result: boolean | undefined;
  walkCommentMarks(ydoc, (_text, _offset, _len, attrs) => {
    if (attrs.commentId === commentId) result = attrs.resolved;
  });
  return result;
}

describe('collab 单元测试', () => {
  afterEach(() => {
    // 每个用例独立内存库，无全局状态残留
  });

  it('a. 双 Y.Doc 离线并发编辑 → 依次 applyUpdate 权威 ydoc → 收敛一致', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const server = new Y.Doc();

    docA.getText('content').insert(0, 'hello from A');
    docB.getText('content').insert(0, 'hello from B');

    // 权威 ydoc 依次应用两端的全量更新
    Y.applyUpdate(server, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(server, Y.encodeStateAsUpdate(docB));

    // 两端拉取权威状态后收敛
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(server));
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(server));

    const text = (d: Y.Doc) => d.getText('content').toString();
    expect(text(docA)).toBe(text(docB));
    expect(text(docA)).toBe(text(server));
  });

  it('b. 快照落库/载入 roundtrip 一致', async () => {
    const db = makeDb();
    const docId = 'doc-roundtrip';
    db.db
      .prepare(
        'INSERT INTO documents (id, title, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        docId,
        '测试文档',
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      );

    const rm = new RoomManager(db);
    const room = rm.acquire(docId, asWebSocket(new MockSocket()));
    // 权威 ydoc 上编辑（全量快照应捕获该内容）
    room.ydoc.getText('content').insert(0, 'persisted text');

    // 全量 flush 落库
    await rm.flushAll();

    // 用全新 RoomManager 从库载入（模拟重启/逐出后重连）
    const rm2 = new RoomManager(db);
    const room2 = rm2.acquire(docId, asWebSocket(new MockSocket()));
    expect(room2.ydoc.getText('content').toString()).toBe('persisted text');
  });

  it('c. ticket 单次使用 + 过期失效', async () => {
    const svc = new TicketService();
    svc.ttlMs = 10; // 10ms TTL，便于测试过期
    const ticket = svc.issue(42);

    expect(svc.consume(ticket)).toBe(42);
    expect(svc.consume(ticket)).toBeNull(); // 一次性：用后即删

    const expired = svc.issue(7);
    await new Promise((r) => setTimeout(r, 30));
    expect(svc.consume(expired)).toBeNull(); // 过期失效

    svc.onModuleDestroy();
  });

  it('d. resolve 评论 → 权威 ydoc Mark resolved 属性变化 + type=100 广播', async () => {
    const db = makeDb();
    const docId = 'doc-mark';
    const commentId = 'comment-1';
    db.db
      .prepare(
        'INSERT INTO documents (id, title, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        docId,
        '带评论文档',
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    db.db
      .prepare(
        'INSERT INTO comments (id, doc_id, author_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        commentId,
        docId,
        1,
        '一条评论',
        new Date().toISOString(),
        new Date().toISOString(),
      );

    const rm = new RoomManager(db);
    const mock = new MockSocket();
    const room = rm.acquire(docId, asWebSocket(mock));

    // 客户端通过 CRDT 通道本地加的评论 Mark（模拟前端高亮）
    room.ydoc.transact(() => {
      const frag = room.ydoc.getXmlFragment('default');
      const p = new Y.XmlElement('paragraph');
      const t = new Y.XmlText();
      t.insert(0, '被评论的文本', { comment: { commentId, resolved: false } });
      p.insert(0, [t]);
      frag.push([p]);
    });

    expect(readMarkResolved(room.ydoc, commentId)).toBe(false);

    // 服务端收口：resolve → Mark resolved 属性变化
    rm.applyCommentMarkChange(docId, 'resolve', commentId);
    expect(readMarkResolved(room.ydoc, commentId)).toBe(true);

    // 广播 type=100 评论活动帧
    rm.broadcastCommentActivity(docId, { type: 'updated', commentId, docId });

    // 解析 mock 收到的帧，找 type=100 帧
    const type100Frames = mock.sent
      .map((frame) => {
        const dec = decoding.createDecoder(frame);
        const type = decoding.readVarUint(dec);
        return type === 100 ? JSON.parse(decoding.readVarString(dec)) : null;
      })
      .filter(Boolean);

    expect(type100Frames.length).toBeGreaterThan(0);
    expect(type100Frames[0]).toMatchObject({
      type: 'updated',
      commentId,
      docId,
    });
  });
});
