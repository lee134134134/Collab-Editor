import type { IncomingMessage } from 'node:http';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocket, WebSocketServer } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import type { AppConfig } from '../config.js';
import { CONFIG } from '../config.js';
import {
  CLOSE_GOING_AWAY,
  CLOSE_UNAUTHORIZED,
  MESSAGE_AWARENESS,
  MESSAGE_QUERY_AWARENESS,
  MESSAGE_SYNC,
  PING_INTERVAL_MS,
} from './protocol.js';
import type { Room } from './room-manager.js';
import { RoomManager } from './room-manager.js';
import { TicketService } from './ticket.service.js';

/**
 * 协同 WebSocket 服务器（原生 ws，独立端口 3001）。
 *
 * 不用 @nestjs/platform-ws：其 upgrade 路由是「精确路径匹配」，与 y-websocket 客户端的
 * serverUrl + '/' + roomname 规则天然冲突（pathname 必多一段 → 被 socket.destroy()）。
 * 这里在 connection 回调里直接解析 req.url：pathname 即 docId，query 带一次性 ticket。
 */
@Injectable()
export class CollabWsServer implements OnModuleInit, OnModuleDestroy {
  private wss: WebSocketServer | null = null;

  constructor(
    @Inject(RoomManager) private readonly roomManager: RoomManager,
    @Inject(TicketService) private readonly ticketService: TicketService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.wss = new WebSocketServer({ port: this.config.wsPort });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (err) => {
      console.error('[CollabWsServer] 端口监听失败', err);
    });
    console.log(
      `[CollabWsServer] 协同 WebSocket 已监听 ws://localhost:${this.config.wsPort}`,
    );
  }

  onModuleDestroy(): void {
    this.close();
  }

  /** 关闭：断开所有客户端连接（code 1001 going away）。 */
  close(): void {
    if (!this.wss) return;
    for (const client of this.wss.clients) {
      try {
        client.close(CLOSE_GOING_AWAY);
      } catch {
        /* 忽略 */
      }
    }
    this.wss.close();
    this.wss = null;
  }

  // ---------------------------------------------------------------- 连接与协议

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // 解析握手 URL：pathname 即 docId；query 带 ticket
    const url = new URL(req.url ?? '/', 'http://localhost');
    const docId = decodeURIComponent(url.pathname.slice(1));
    const ticket = url.searchParams.get('ticket') ?? '';

    // Origin 白名单校验：无 Origin 头（非浏览器客户端）放行；有则必须在白名单内
    const origin = req.headers.origin;
    if (origin && !this.config.collabAllowedOrigins.includes(origin)) {
      ws.close(CLOSE_UNAUTHORIZED, 'origin not allowed');
      return;
    }

    // ticket 鉴权：一次性、60s 有效；无效/过期 → 4401（客户端视为永久失败，不再重连）
    const userId = this.ticketService.consume(ticket);
    if (userId === null || !docId) {
      ws.close(CLOSE_UNAUTHORIZED, 'invalid or expired ticket');
      return;
    }

    ws.binaryType = 'arraybuffer';
    const room = this.roomManager.acquire(docId, ws);

    ws.on('message', (data) =>
      this.handleMessage(ws, room, new Uint8Array(data as Buffer)),
    );
    ws.on('error', () => {
      /* 错误交由 close 事件统一清理 */
    });

    // 心跳保活：每 30s ping，连续 2 次无 pong 则 terminate
    let missedPongs = 0;
    const pingTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(pingTimer);
        return;
      }
      if (missedPongs >= 2) {
        ws.terminate();
        clearInterval(pingTimer);
        return;
      }
      missedPongs += 1;
      try {
        ws.ping();
      } catch {
        ws.terminate();
        clearInterval(pingTimer);
      }
    }, PING_INTERVAL_MS);
    ws.on('pong', () => {
      missedPongs = 0;
    });

    ws.on('close', () => {
      clearInterval(pingTimer);
      this.roomManager.removeConnection(docId, ws);
    });

    // 连接建立即发 sync step1（权威 doc 的 state vector）+ 其他客户端的 awareness 状态
    // 注意：room.awareness 是服务端自建的 Awareness 实例，其 getStates() 永久包含一条
    // 服务端自身 clientID 的空状态（{}），若不排除会被前端渲染成幽灵「未知用户」。
    const syncEnc = encoding.createEncoder();
    encoding.writeVarUint(syncEnc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEnc, room.ydoc);
    this.send(ws, encoding.toUint8Array(syncEnc));

    const remoteClients = Array.from(room.awareness.getStates().keys()).filter(
      (clientId) => clientId !== room.awareness.clientID,
    );
    if (remoteClients.length > 0) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        enc,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, remoteClients),
      );
      this.send(ws, encoding.toUint8Array(enc));
    }
  }

  private handleMessage(ws: WebSocket, room: Room, data: Uint8Array): void {
    try {
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          // readSyncMessage 内部处理 step1（回 step2 差量）/ step2、update（applyUpdate 到权威 ydoc）
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, ws);
          // 只有 step1 才会产生回包（长度 >1 表示写入了回包内容）
          if (encoding.length(encoder) > 1) {
            this.send(ws, encoding.toUint8Array(encoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          this.roomManager.applyAwareness(room, update, ws);
          break;
        }
        case MESSAGE_QUERY_AWARENESS: {
          const remoteClients = Array.from(
            room.awareness.getStates().keys(),
          ).filter((clientId) => clientId !== room.awareness.clientID);
          if (remoteClients.length > 0) {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
            encoding.writeVarUint8Array(
              encoder,
              awarenessProtocol.encodeAwarenessUpdate(
                room.awareness,
                remoteClients,
              ),
            );
            this.send(ws, encoding.toUint8Array(encoder));
          }
          break;
        }
        default:
          // 未知消息类型：忽略（协议扩展位）
          break;
      }
    } catch (err) {
      console.error('[CollabWsServer] 消息处理失败', err);
    }
  }

  private send(ws: WebSocket, data: Uint8Array): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch {
        /* 连接异常，忽略 */
      }
    }
  }
}
