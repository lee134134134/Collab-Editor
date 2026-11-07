import { ArrowLeftOutlined, MessageOutlined } from '@ant-design/icons';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import {
  absolutePositionToRelativePosition,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';
import { history, useModel, useParams } from '@umijs/max';
import { Button, Input, Modal, message, Spin, Tooltip, theme } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { createComment } from '@/services/comments';
import { getDoc, updateDoc } from '@/services/docs';
import { CommentPanel } from './components/CommentPanel';
import {
  ConnectionBanner,
  ConnectionStatus,
} from './components/ConnectionStatus';
import { CommentMark } from './components/commentMark';
import { EditorToolbar } from './components/EditorToolbar';
import { PresenceBar } from './components/PresenceBar';
import { useCollabDoc } from './components/useCollabDoc';
import './components/editor.css';

/** 允许在 style 上挂载 CSS 变量（从 antd token 派生，供 editor.css 使用） */
type CssVarStyle = React.CSSProperties & Record<`--${string}`, string>;

const DocEditor: React.FC = () => {
  const { id: docId } = useParams<{ id: string }>();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const { token } = theme.useToken();

  const { ydoc, provider, status, reconnect } = useCollabDoc(docId ?? '');
  const [docLoading, setDocLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  // 窄屏默认收起评论，避免一进来就盖住正文；宽屏保持常驻
  const [commentPanelOpen, setCommentPanelOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth > 1024,
  );
  // 断线提示延迟出现：初次进入的一两秒「连接中」不应让横幅闪一下
  const [connectionNoticeVisible, setConnectionNoticeVisible] = useState(false);

  useEffect(() => {
    if (status === 'connected') {
      setConnectionNoticeVisible(false);
      return;
    }
    if (status === 'disconnected') {
      setConnectionNoticeVisible(true);
      return;
    }
    if (connectionNoticeVisible) return;
    const timer = window.setTimeout(
      () => setConnectionNoticeVisible(true),
      2000,
    );
    return () => window.clearTimeout(timer);
  }, [status, connectionNoticeVisible]);

  // 拉取文档元信息
  useEffect(() => {
    if (!docId) return;
    setDocLoading(true);
    getDoc(docId, { skipErrorHandler: true })
      .then((d) => setTitle(d.title))
      .catch((err: any) => {
        const statusCode = err?.response?.status;
        if (statusCode === 404) {
          message.error('文档不存在');
          history.push('/docs');
        }
      })
      .finally(() => setDocLoading(false));
  }, [docId]);

  // 标题防抖保存（800ms）
  const titleTimerRef = useRef<number | null>(null);
  const saveTitle = (nextTitle: string) => {
    if (titleTimerRef.current != null) {
      window.clearTimeout(titleTimerRef.current);
    }
    titleTimerRef.current = window.setTimeout(async () => {
      titleTimerRef.current = null;
      if (!docId || !nextTitle.trim()) return;
      try {
        await updateDoc(docId, { title: nextTitle.trim() });
      } catch {
        // requestErrorConfig 已处理
      }
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (titleTimerRef.current != null) {
        window.clearTimeout(titleTimerRef.current);
      }
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setTitle(next);
    saveTitle(next);
  };

  const editor = useEditor(
    {
      // ydoc/provider 未就绪时用 StarterKit 作占位 schema：
      // ProseMirror 必须有 doc 顶层节点，空扩展数组会在构造时直接抛
      // "Schema is missing its top node type ('doc')"；就绪后依赖变化会触发 useEditor 重建
      extensions:
        ydoc && provider
          ? [
              StarterKit.configure({ undoRedo: false }),
              Collaboration.configure({ document: ydoc }),
              CollaborationCaret.configure({
                provider,
                user: {
                  name:
                    currentUser?.displayName ?? currentUser?.name ?? '匿名用户',
                  color: currentUser?.color ?? '#1677ff',
                },
              }),
              Placeholder.configure({
                placeholder: '开始协作编辑…',
                emptyEditorClass: 'is-editor-empty',
              }),
              Table.configure({ resizable: false }),
              TableRow,
              TableHeader,
              TableCell,
              CommentMark,
            ]
          : [StarterKit.configure({ undoRedo: false })],
      editable: true,
    },
    [
      ydoc,
      provider,
      currentUser?.name,
      currentUser?.displayName,
      currentUser?.color,
    ],
  );

  // React 19 StrictMode：effect 中必须判 editor.isDestroyed
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // 编辑器就绪后的初始化逻辑（如需要）
  }, [editor]);

  const openCommentModal = () => {
    if (!editor) return;
    setCommentContent('');
    setCommentModalOpen(true);
  };

  const handleCreateComment = async () => {
    if (!editor || !docId || !ydoc) return;
    const content = commentContent.trim();
    if (!content) {
      message.warning('请输入批注内容');
      return;
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      message.warning('请先选中文本');
      return;
    }

    const syncState = ySyncPluginKey.getState(editor.view.state);
    if (!syncState) {
      message.error('编辑器尚未就绪');
      return;
    }

    setCommentSubmitting(true);
    try {
      const quote = editor.state.doc.textBetween(from, to, ' ');
      const startRel = absolutePositionToRelativePosition(
        from,
        syncState.type,
        syncState.binding.mapping,
      );
      const endRel = absolutePositionToRelativePosition(
        to,
        syncState.type,
        syncState.binding.mapping,
      );
      const anchor = {
        start: btoa(String.fromCharCode(...Y.encodeRelativePosition(startRel))),
        end: btoa(String.fromCharCode(...Y.encodeRelativePosition(endRel))),
        quote,
      };

      const comment = await createComment(docId, { content, anchor });
      editor.chain().focus().setComment({ commentId: comment.id }).run();
      message.success('批注已添加');
      setCommentModalOpen(false);
      setCommentContent('');
    } catch {
      // requestErrorConfig 已处理
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (!docId) {
    message.error('缺少文档 ID');
    history.push('/docs');
    return null;
  }

  // 从 antd token 派生 CSS 变量，集中给 editor.css 复用（浅色主题自适应）
  const docThemeStyle: CssVarStyle = {
    '--doc-canvas': token.colorBgLayout,
    '--doc-surface': token.colorBgContainer,
    '--doc-surface-muted': token.colorFillQuaternary,
    '--doc-fill': token.colorFillTertiary,
    '--doc-border': token.colorBorderSecondary,
    '--doc-border-strong': token.colorBorder,
    '--doc-text': token.colorText,
    '--doc-text-2': token.colorTextSecondary,
    '--doc-text-3': token.colorTextTertiary,
    '--doc-primary': token.colorPrimary,
    '--doc-primary-soft': token.colorPrimaryBg,
    '--doc-primary-border': token.colorPrimaryBorder,
    '--doc-success': token.colorSuccess,
    '--doc-success-bg': token.colorSuccessBg,
    '--doc-success-border': token.colorSuccessBorder,
    '--doc-warning': token.colorWarning,
    '--doc-warning-bg': token.colorWarningBg,
    '--doc-warning-border': token.colorWarningBorder,
    '--doc-error': token.colorError,
    '--doc-error-bg': token.colorErrorBg,
    '--doc-error-border': token.colorErrorBorder,
    '--doc-radius': `${token.borderRadius}px`,
    '--doc-radius-lg': `${token.borderRadiusLG}px`,
    '--doc-shadow-paper': token.boxShadowTertiary,
    '--doc-shadow-float': token.boxShadowSecondary,
  };

  if (docLoading || !ydoc || !provider) {
    return (
      <div className="doc-editor" style={docThemeStyle}>
        <div className="doc-editor__loading">
          <div className="doc-editor__loading-card">
            <Spin size="large" />
            <span className="doc-editor__loading-text">正在连接协同文档…</span>
          </div>
        </div>
      </div>
    );
  }

  // ydoc/provider 刚就绪的那一帧，useEditor 尚未重建，editor 仍是只有 StarterKit 的占位实例
  // （没有 collaboration 扩展，也就没有 undo/redo/表格/链接命令）。用扩展存在性判定，
  // 避免占位实例渲染工具栏时抛 "editor.can(...).undo is not a function"。
  const collabReady = Boolean(
    editor &&
      ydoc &&
      provider &&
      editor.extensionManager.extensions.some(
        (ext) => ext.name === 'collaboration',
      ),
  );

  const commentToggleLabel = commentPanelOpen ? '收起评论' : '展开评论';

  return (
    <div className="doc-editor" style={docThemeStyle}>
      {/* 顶栏 */}
      <header className="doc-editor__header">
        <div className="doc-editor__header-main">
          <Tooltip title="返回文档库">
            <Button
              type="text"
              className="doc-editor__icon-btn"
              icon={<ArrowLeftOutlined />}
              aria-label="返回文档库"
              onClick={() => history.push('/docs')}
            />
          </Tooltip>
          <div className="doc-editor__title-field">
            <Input
              className="doc-editor__title-input"
              value={title}
              onChange={handleTitleChange}
              placeholder="文档标题"
              aria-label="文档标题"
              variant="borderless"
            />
          </div>
        </div>
        <div className="doc-editor__header-actions">
          <PresenceBar provider={provider} />
          <ConnectionStatus status={status} onReconnect={reconnect} />
          <Tooltip title={commentToggleLabel}>
            <Button
              type="text"
              className={`doc-editor__icon-btn${
                commentPanelOpen ? ' doc-editor__icon-btn--active' : ''
              }`}
              icon={<MessageOutlined />}
              aria-label={commentToggleLabel}
              aria-pressed={commentPanelOpen}
              onClick={() => setCommentPanelOpen((open) => !open)}
            />
          </Tooltip>
        </div>
      </header>

      {/* 连接异常提示：细横幅，不遮挡编辑区 */}
      {connectionNoticeVisible && (
        <ConnectionBanner status={status} onReconnect={reconnect} />
      )}

      {/* 工具栏 */}
      {collabReady && editor && <EditorToolbar editor={editor} />}

      {/* 编辑区 + 评论面板 */}
      <div className="doc-editor__body">
        <main className="doc-editor__content">
          <div className="doc-editor__paper">
            {collabReady && editor && <EditorContent editor={editor} />}
          </div>
        </main>
        {collabReady && editor && ydoc && (
          <CommentPanel
            docId={docId}
            editor={editor}
            ydoc={ydoc}
            visible={commentPanelOpen}
            onClose={() => setCommentPanelOpen(false)}
          />
        )}
      </div>

      {/* 选区 BubbleMenu */}
      {collabReady && editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top' }}
          shouldShow={({ editor: e }) => {
            const { from, to } = e.state.selection;
            return from !== to && e.isEditable;
          }}
        >
          <div className="doc-editor__bubble">
            <Button
              type="text"
              size="small"
              className="doc-editor__bubble-btn"
              icon={<MessageOutlined />}
              onClick={openCommentModal}
            >
              批注
            </Button>
          </div>
        </BubbleMenu>
      )}

      {/* 批注内容 Modal */}
      <Modal
        title="添加批注"
        open={commentModalOpen}
        onOk={handleCreateComment}
        onCancel={() => setCommentModalOpen(false)}
        confirmLoading={commentSubmitting}
        okText="添加"
        cancelText="取消"
      >
        <Input.TextArea
          rows={4}
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="请输入批注内容"
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleCreateComment();
            }
          }}
        />
      </Modal>
    </div>
  );
};

export default DocEditor;
