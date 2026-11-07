import {
  CheckOutlined,
  CloseOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import type { CommentThread } from '@collab/shared';
import type { Editor } from '@tiptap/react';
import {
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  message,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import type { CommentDTO } from '@/services/comments';
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from '@/services/comments';

interface CommentPanelProps {
  docId: string;
  editor: Editor;
  ydoc: Y.Doc;
}

const FLASH_CLASS = 'comment-flash';

/**
 * 将评论按 parent_id 组装成线程树
 */
function buildThreads(comments: CommentDTO[]): CommentThread[] {
  const roots = comments.filter((c) => !c.parentId);
  return roots.map((root) => ({
    ...root,
    author: root.author,
    anchor: root.anchor,
    replies: comments.filter((c) => c.parentId === root.id),
  }));
}

export const CommentPanel: React.FC<CommentPanelProps> = ({
  docId,
  editor,
  ydoc,
}) => {
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const threads = useMemo(() => buildThreads(comments), [comments]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listComments(docId);
      setComments(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [docId]);

  // 监听协同消息触发的评论活动事件，防抖刷新列表
  useEffect(() => {
    let timer: number | null = null;
    const handler = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        load();
      }, 500);
    };
    window.addEventListener('collab:comment-activity', handler);
    return () => {
      window.removeEventListener('collab:comment-activity', handler);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [docId]);

  const handleResolve = async (commentId: string, resolved: boolean) => {
    try {
      await updateComment(docId, commentId, { resolved });
      // 服务端会广播 Mark 变更；前端不本地改 Mark
      message.success(resolved ? '已解决' : '已重开');
      load();
    } catch {
      // requestErrorConfig 已处理
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(docId, commentId);
      message.success('已删除');
      load();
    } catch {
      // requestErrorConfig 已处理
    }
  };

  const handleReply = async (parentId: string) => {
    const content = replyContent.trim();
    if (!content) {
      message.warning('请输入回复内容');
      return;
    }
    setReplyLoading(true);
    try {
      await createComment(docId, { content, parentId });
      setReplyContent('');
      setReplyTo(null);
      load();
    } catch {
      // requestErrorConfig 已处理
    } finally {
      setReplyLoading(false);
    }
  };

  /**
   * 解析评论锚点并在编辑器内定位、闪烁高亮
   */
  const navigateToComment = (thread: CommentThread) => {
    if (!thread.anchor) return;
    const syncState = ySyncPluginKey.getState(editor.view.state);
    if (!syncState) return;

    try {
      const startBytes = Uint8Array.from(atob(thread.anchor.start), (c) =>
        c.charCodeAt(0),
      );
      const endBytes = Uint8Array.from(atob(thread.anchor.end), (c) =>
        c.charCodeAt(0),
      );
      const startRel = Y.decodeRelativePosition(startBytes);
      const endRel = Y.decodeRelativePosition(endBytes);
      const start = relativePositionToAbsolutePosition(
        ydoc,
        syncState.type,
        startRel,
        syncState.binding.mapping,
      );
      const end = relativePositionToAbsolutePosition(
        ydoc,
        syncState.type,
        endRel,
        syncState.binding.mapping,
      );

      if (start == null || end == null) {
        message.warning('原文已被删除');
        return;
      }

      editor
        .chain()
        .focus()
        .setTextSelection({ from: start, to: end })
        .scrollIntoView()
        .run();

      // 闪烁高亮：给锚点范围内文本加临时 class
      flashRange(start, end);
    } catch {
      message.warning('原文已被删除');
    }
  };

  const flashRange = (from: number, to: number) => {
    try {
      const view = editor.view;
      const startDom = view.domAtPos(from);
      const endDom = view.domAtPos(to);
      // 简单处理：尝试找到共同祖先节点并加 class
      const range = document.createRange();
      range.setStart(startDom.node, startDom.offset);
      range.setEnd(endDom.node, endDom.offset);
      const wrapper = document.createElement('span');
      wrapper.className = FLASH_CLASS;
      try {
        range.surroundContents(wrapper);
        window.setTimeout(() => {
          const parent = wrapper.parentNode;
          if (parent) {
            while (wrapper.firstChild) {
              parent.insertBefore(wrapper.firstChild, wrapper);
            }
            parent.removeChild(wrapper);
          }
        }, 1500);
      } catch {
        // 复杂选区可能无法 surround，忽略
      }
    } catch {
      // ignore
    }
  };

  const renderThread = (thread: CommentThread) => (
    <div key={thread.id} className="comment-thread">
      {thread.anchor?.quote && (
        <Typography.Paragraph
          type="secondary"
          className="comment-thread__quote"
          ellipsis={{ rows: 2 }}
        >
          「{thread.anchor.quote}」
        </Typography.Paragraph>
      )}
      <Space align="start" className="comment-thread__header">
        <Avatar
          size="small"
          style={{
            backgroundColor: thread.author.color,
            color: '#fff',
          }}
        >
          {thread.author.displayName?.slice(0, 1) ??
            thread.author.username.slice(0, 1)}
        </Avatar>
        <div style={{ flex: 1 }}>
          <Space>
            <Typography.Text strong>
              {thread.author.displayName ?? thread.author.username}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(thread.createdAt).format('MM-DD HH:mm')}
            </Typography.Text>
          </Space>
          <div>
            <Typography.Text>{thread.content}</Typography.Text>
          </div>
          <Space size="small" style={{ marginTop: 8 }}>
            <Button
              type="text"
              size="small"
              icon={<MessageOutlined />}
              onClick={() =>
                setReplyTo(replyTo === thread.id ? null : thread.id)
              }
            >
              回复
            </Button>
            <Button
              type="text"
              size="small"
              onClick={() => navigateToComment(thread)}
            >
              定位
            </Button>
            <Switch
              checkedChildren={<CheckOutlined />}
              unCheckedChildren={<CloseOutlined />}
              checked={thread.resolved}
              onChange={(checked) => handleResolve(thread.id, checked)}
              size="small"
            />
            <Button
              type="text"
              danger
              size="small"
              onClick={() => handleDelete(thread.id)}
            >
              删除
            </Button>
          </Space>
          {replyTo === thread.id && (
            <div style={{ marginTop: 8 }}>
              <Input.TextArea
                rows={2}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="回复..."
              />
              <Space style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  size="small"
                  loading={replyLoading}
                  onClick={() => handleReply(thread.id)}
                >
                  发送
                </Button>
                <Button size="small" onClick={() => setReplyTo(null)}>
                  取消
                </Button>
              </Space>
            </div>
          )}
          {thread.replies.length > 0 && (
            <div className="comment-thread__replies">
              {thread.replies.map((reply) => (
                <div key={reply.id} className="comment-thread__reply">
                  <Space align="start">
                    <Avatar
                      size="small"
                      style={{
                        backgroundColor: reply.author.color,
                        color: '#fff',
                      }}
                    >
                      {reply.author.displayName?.slice(0, 1) ??
                        reply.author.username.slice(0, 1)}
                    </Avatar>
                    <div>
                      <Typography.Text strong style={{ fontSize: 12 }}>
                        {reply.author.displayName ?? reply.author.username}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, marginLeft: 8 }}
                      >
                        {dayjs(reply.createdAt).format('MM-DD HH:mm')}
                      </Typography.Text>
                      <div>
                        <Typography.Text>{reply.content}</Typography.Text>
                      </div>
                    </div>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </div>
      </Space>
    </div>
  );

  return (
    <Card
      title="评论"
      size="small"
      className="comment-panel"
      variant="borderless"
    >
      {loading ? (
        <Spin description="加载中..." />
      ) : threads.length === 0 ? (
        <Empty description="暂无批注" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="comment-panel__list">{threads.map(renderThread)}</div>
      )}
    </Card>
  );
};
