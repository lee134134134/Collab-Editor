import type { CollabStatus, CommentActivityEvent } from '@collab/shared';
import { WS_MSG_COMMENT_ACTIVITY } from '@collab/shared';
import { useModel } from '@umijs/max';
import * as decoding from 'lib0/decoding';
import { useEffect, useRef, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { getCollabTicket } from '@/services/self/auth';

/**
 * 协同文档 hook
 * - effect 内创建 Y.Doc 与 WebsocketProvider
 * - ticket 失效（close 4401）或手动触发时，destroy 后按指数退避重建
 * - 卸载时完整 destroy provider + ydoc
 */
export interface UseCollabDocResult {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  status: CollabStatus;
  reconnect: () => void;
}

const DEFAULT_WS_URL = 'ws://localhost:3001';

export function useCollabDoc(docId: string): UseCollabDocResult {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [reconnectKey, setReconnectKey] = useState(0);

  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  const clearReconnectTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleReconnect = (immediate = false) => {
    clearReconnectTimer();
    if (unmountedRef.current) return;

    if (immediate) {
      setReconnectKey((k) => k + 1);
      return;
    }

    // 指数退避：1s 起，10s 封顶
    const delay = Math.min(1000 * 2 ** attemptRef.current, 10000);
    attemptRef.current += 1;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (!unmountedRef.current) {
        setReconnectKey((k) => k + 1);
      }
    }, delay);
  };

  useEffect(() => {
    unmountedRef.current = false;

    let activeYdoc: Y.Doc | null = null;
    let activeProvider: WebsocketProvider | null = null;

    const setup = async () => {
      try {
        const { ticket } = await getCollabTicket({ skipErrorHandler: true });
        if (unmountedRef.current) return;

        const doc = new Y.Doc();
        activeYdoc = doc;

        const wsUrl = process.env.UMI_APP_COLLAB_WS_URL ?? DEFAULT_WS_URL;
        const wsProvider = new WebsocketProvider(wsUrl, docId, doc, {
          params: { ticket },
          // 让 y-websocket 自己处理普通断线的重连；4401  Permanent 失败在下面监听 closed 手动重建
          maxBackoffTime: 10000,
        });
        activeProvider = wsProvider;

        // 发布本地用户在线状态
        wsProvider.awareness.setLocalStateField('user', {
          name: currentUser?.displayName ?? currentUser?.name ?? '匿名用户',
          color: currentUser?.color ?? '#1677ff',
        });

        wsProvider.on('status', ({ status: s }) => {
          setStatus(s);
          if (s === 'connected') {
            attemptRef.current = 0;
          }
        });

        wsProvider.on('closed', (event) => {
          // 4401 表示 ticket 鉴权失败，需要换 ticket 重建
          if (event.code === 4401) {
            scheduleReconnect(false);
          }
        });

        // 监听服务端下发的评论活动事件（type === 100）
        wsProvider.messageHandlers[WS_MSG_COMMENT_ACTIVITY] = (
          _encoder,
          decoder,
          _provider,
        ) => {
          const json = decoding.readVarString(decoder);
          try {
            const evt = JSON.parse(json) as CommentActivityEvent;
            // 通过自定义事件广播给编辑器内监听，避免 hook 返回过多状态
            window.dispatchEvent(
              new CustomEvent('collab:comment-activity', { detail: evt }),
            );
          } catch {
            // 忽略无法解析的消息
          }
        };

        setYdoc(doc);
        setProvider(wsProvider);
      } catch {
        // 取 ticket 失败也按退避重试
        if (!unmountedRef.current) {
          scheduleReconnect(false);
        }
      }
    };

    setup();

    return () => {
      unmountedRef.current = true;
      clearReconnectTimer();
      activeProvider?.destroy();
      activeYdoc?.destroy();
      setYdoc(null);
      setProvider(null);
      setStatus('disconnected');
    };
  }, [
    docId,
    reconnectKey,
    currentUser?.name,
    currentUser?.displayName,
    currentUser?.color,
  ]);

  return {
    ydoc,
    provider,
    status,
    reconnect: () => scheduleReconnect(true),
  };
}
