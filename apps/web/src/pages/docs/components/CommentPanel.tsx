import {
  AimOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
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
  Empty,
  Input,
  message,
  Popconfirm,
  Skeleton,
  Tooltip,
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
  /** 窄屏下由顶栏切换；宽屏常驻 */
  visible: boolean;
  onClose: () => void;
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

const getInitial = (author: CommentDTO['author']) =>
  author.displayName?.slice(0, 1) ?? author.username.slice(0, 1);

const getAuthorName = (author: CommentDTO['author']) =>
  author.displayName ?? author.username;

export const CommentPanel: React.FC<CommentPanelProps> = ({
  docId,
  editor,
  ydoc,
  visible,
  onClose,
}) => {
  const [comments, setComments] = useState<CommentDTO[]>([]);
  // 首屏直接给骨架屏，避免空态闪一下
  const [loading, setLoading] = useState(true);
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

  const renderReply = (reply: CommentDTO) => (
    <div key={reply.id} className="comment-reply">
      <Avatar
        size={20}
        className="comment-reply__avatar"
        style={{ backgroundColor: reply.author.color, color: '#fff' }}
      >
        {getInitial(reply.author)}
      </Avatar>
      <div className="comment-reply__main">
        <div className="comment-reply__meta">
          <span className="comment-reply__author">
            {getAuthorName(reply.author)}
          </span>
          <span className="comment-reply__time">
            {dayjs(reply.createdAt).format('MM-DD HH:mm')}
          </span>
        </div>
        <p className="comment-reply__content">{reply.content}</p>
      </div>
    </div>
  );

  const renderThread = (thread: CommentThread) => {
    const resolved = thread.resolved;
    return (
      <article
        key={thread.id}
        className={`comment-card${resolved ? ' comment-card--resolved' : ''}`}
      >
        {thread.anchor?.quote && (
          <p className="comment-card__quote" title={thread.anchor.quote}>
            {thread.anchor.quote}
          </p>
        )}

        <div className="comment-card__meta">
          <Avatar
            size={22}
            style={{ backgroundColor: thread.author.color, color: '#fff' }}
          >
            {getInitial(thread.author)}
          </Avatar>
          <span className="comment-card__author">
            {getAuthorName(thread.author)}
          </span>
          <span className="comment-card__time">
            {dayjs(thread.createdAt).format('MM-DD HH:mm')}
          </span>
          {resolved && <span className="comment-card__resolved">已解决</span>}
        </div>

        <p className="comment-card__content">{thread.content}</p>

        <div className="comment-card__actions">
          <Button
            type="text"
            size="small"
            icon={<MessageOutlined />}
            aria-pressed={replyTo === thread.id}
            onClick={() => setReplyTo(replyTo === thread.id ? null : thread.id)}
          >
            回复
          </Button>
          <Button
            type="text"
            size="small"
            icon={<AimOutlined />}
            disabled={!thread.anchor}
            onClick={() => navigateToComment(thread)}
          >
            定位
          </Button>
          <Tooltip title={resolved ? '重新打开这条批注' : '标记为已解决'}>
            <Button
              type="text"
              size="small"
              className={`comment-card__resolve${
                resolved ? ' comment-card__resolve--active' : ''
              }`}
              icon={<CheckCircleOutlined />}
              aria-pressed={resolved}
              onClick={() => handleResolve(thread.id, !resolved)}
            >
              {resolved ? '重开' : '解决'}
            </Button>
          </Tooltip>
          <span className="comment-card__spacer" />
          <Popconfirm
            title="删除这条批注？"
            description="删除后不可恢复"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(thread.id)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除批注"
            />
          </Popconfirm>
        </div>

        {replyTo === thread.id && (
          <div className="comment-card__reply-editor">
            <Input.TextArea
              autoFocus
              rows={2}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="输入回复…"
            />
            <div className="comment-card__reply-actions">
              <Button size="small" onClick={() => setReplyTo(null)}>
                取消
              </Button>
              <Button
                type="primary"
                size="small"
                loading={replyLoading}
                onClick={() => handleReply(thread.id)}
              >
                发送
              </Button>
            </div>
          </div>
        )}

        {thread.replies.length > 0 && (
          <div className="comment-card__replies">
            {thread.replies.map(renderReply)}
          </div>
        )}
      </article>
    );
  };

  const renderSkeleton = () => (
    <div className="comment-panel__list">
      {[0, 1].map((key) => (
        <div key={key} className="comment-card comment-card--skeleton">
          <Skeleton
            active
            title={false}
            paragraph={{ rows: 3, width: ['76%', '100%', '52%'] }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <aside
      className={`comment-panel${visible ? '' : ' comment-panel--hidden'}`}
      aria-label="评论面板"
    >
      <div className="comment-panel__header">
        <div className="comment-panel__heading">
          <span className="comment-panel__title">评论</span>
          {threads.length > 0 && (
            <span className="comment-panel__count">{threads.length}</span>
          )}
        </div>
        <Tooltip title="收起评论">
          <Button
            type="text"
            size="small"
            className="comment-panel__close"
            icon={<CloseOutlined />}
            aria-label="收起评论"
            onClick={onClose}
          />
        </Tooltip>
      </div>

      <div className="comment-panel__body" aria-busy={loading}>
        {loading ? (
          renderSkeleton()
        ) : threads.length === 0 ? (
          <div className="comment-panel__empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="还没有批注"
            />
            <p className="comment-panel__empty-hint">
              选中正文内容后点击「批注」即可添加
            </p>
          </div>
        ) : (
          <div className="comment-panel__list">{threads.map(renderThread)}</div>
        )}
      </div>
    </aside>
  );
};
