import {
  CheckCircleFilled,
  DisconnectOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { CollabStatus } from '@collab/shared';
import { Button, Tooltip } from 'antd';
import React from 'react';

interface StatusMeta {
  text: string;
  tip: string;
}

const STATUS_META: Record<CollabStatus, StatusMeta> = {
  connected: { text: '已连接', tip: '实时协同已连接' },
  connecting: { text: '连接中', tip: '正在连接实时协同服务，点击立即重连' },
  disconnected: { text: '已断线', tip: '实时协同已断开，点击立即重连' },
};

interface ConnectionStatusProps {
  status: CollabStatus;
  onReconnect: () => void;
}

/**
 * 顶栏连接状态胶囊
 * - connected 仅展示状态
 * - 其余状态可点击触发手动重连（与横幅里的「立即重连」同一个回调）
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  onReconnect,
}) => {
  const meta = STATUS_META[status];

  const pill = (
    <span className={`connection-status connection-status--${status}`}>
      {status === 'connected' ? (
        <CheckCircleFilled className="connection-status__icon" />
      ) : status === 'connecting' ? (
        <LoadingOutlined className="connection-status__icon" spin />
      ) : (
        <DisconnectOutlined className="connection-status__icon" />
      )}
      <span className="connection-status__text">{meta.text}</span>
    </span>
  );

  if (status === 'connected') {
    return (
      <Tooltip title={meta.tip}>
        <span className="connection-status__static">{pill}</span>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={meta.tip}>
      <Button
        type="text"
        size="small"
        className="connection-status__button"
        aria-label={`${meta.text}，点击立即重连`}
        onClick={onReconnect}
      >
        {pill}
      </Button>
    </Tooltip>
  );
};

interface ConnectionBannerProps {
  status: CollabStatus;
  onReconnect: () => void;
}

/**
 * 非阻塞连接提示条
 * 说明断线期间仍可继续编辑、正在自动重连，并给出手动重连入口
 */
export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  status,
  onReconnect,
}) => {
  if (status === 'connected') return null;

  const disconnected = status === 'disconnected';

  return (
    <div className={`connection-banner connection-banner--${status}`}>
      <span className="connection-banner__icon" aria-hidden="true">
        {disconnected ? <DisconnectOutlined /> : <LoadingOutlined spin />}
      </span>
      <span className="connection-banner__text" role="status">
        {disconnected
          ? '实时协同已断开，正在自动重连。当前页面仍可编辑，但离线修改可能无法同步，建议等待连接恢复。'
          : '正在重新连接协同服务。若长时间未恢复，可点击「立即重连」。'}
      </span>
      <Button
        type="link"
        size="small"
        className="connection-banner__action"
        onClick={onReconnect}
      >
        立即重连
      </Button>
    </div>
  );
};
