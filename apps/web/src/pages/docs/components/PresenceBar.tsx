import type { PresenceUser } from '@collab/shared';
import { Avatar, Tooltip } from 'antd';
import React, { useEffect, useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';

interface PresenceBarProps {
  provider: WebsocketProvider;
}

/**
 * 在线用户头像条
 * 从 provider.awareness.getStates() 读取远端用户，过滤本地 client
 */
export const PresenceBar: React.FC<PresenceBarProps> = ({ provider }) => {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!provider) return;

    const localClientId = provider.doc.clientID;

    const refresh = () => {
      const states = Array.from(provider.awareness.getStates().entries());
      const list = states
        .filter(([clientId]) => clientId !== localClientId)
        .map(([clientId, state]) => {
          const user = (state as { user?: { name?: string; color?: string } })
            ?.user;
          // 忽略未发布 user 字段的客户端（如服务端中继、原始 Yjs 客户端），
          // 否则会显示成幽灵「未知用户」
          if (!user?.name) return null;
          return {
            clientId,
            name: user.name,
            color: user.color ?? '#999',
          };
        })
        .filter((u): u is PresenceUser => u !== null);
      setUsers(list);
    };

    refresh();
    provider.awareness.on('change', refresh);
    return () => {
      provider.awareness.off('change', refresh);
    };
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <Avatar.Group max={{ count: 6 }}>
      {users.map((u) => (
        <Tooltip key={u.clientId} title={u.name}>
          <Avatar
            style={{
              backgroundColor: u.color,
              color: '#fff',
              fontSize: 12,
            }}
            size="small"
          >
            {u.name.slice(0, 1)}
          </Avatar>
        </Tooltip>
      ))}
    </Avatar.Group>
  );
};
