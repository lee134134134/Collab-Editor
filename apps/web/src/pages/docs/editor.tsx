import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
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
import { Button, Input, Modal, message, Spin, Tag, Tooltip } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { createComment } from '@/services/comments';
import { getDoc, updateDoc } from '@/services/docs';
import { CommentPanel } from './components/CommentPanel';
import { CommentMark } from './components/commentMark';
import { EditorToolbar } from './components/EditorToolbar';
import { PresenceBar } from './components/PresenceBar';
import { useCollabDoc } from './components/useCollabDoc';
import './components/editor.css';

const statusTag = {
  connected: { color: 'success', text: '已连接' },
  connecting: { color: 'processing', text: '连接中' },
  disconnected: { color: 'error', text: '已断线' },
} as const;

const DocEditor: React.FC = () => {
  const { id: docId } = useParams<{ id: string }>();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;

  const { ydoc, provider, status, reconnect } = useCollabDoc(docId ?? '');
  const [docLoading, setDocLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

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

  if (docLoading || !ydoc || !provider) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin description="正在连接协同文档…" />
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

  const tag = statusTag[status];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        background: '#fff',
      }}
    >
      {/* 顶栏 */}
      <div className="doc-editor__header">
        <Tooltip title="返回文档库">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => history.push('/docs')}
          />
        </Tooltip>
        <Input
          className="doc-editor__title-input"
          value={title}
          onChange={handleTitleChange}
          placeholder="文档标题"
          variant="borderless"
        />
        <PresenceBar provider={provider} />
        <Tag color={tag.color}>{tag.text}</Tag>
        <Tooltip title="手动重连">
          <Button icon={<ReloadOutlined />} onClick={reconnect}>
            重连
          </Button>
        </Tooltip>
      </div>

      {/* 工具栏 */}
      {collabReady && editor && <EditorToolbar editor={editor} />}

      {/* 编辑区 + 评论面板 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="doc-editor__content">
          <div className="doc-editor__paper">
            {collabReady && editor && <EditorContent editor={editor} />}
          </div>
        </div>
        {collabReady && editor && ydoc && (
          <CommentPanel docId={docId} editor={editor} ydoc={ydoc} />
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
          <Button
            type="primary"
            size="small"
            className="doc-editor__bubble-btn"
            onClick={openCommentModal}
          >
            批注
          </Button>
        </BubbleMenu>
      )}

      {/* 批注内容 Modal */}
      <Modal
        title="添加批注"
        open={commentModalOpen}
        onOk={handleCreateComment}
        onCancel={() => setCommentModalOpen(false)}
        confirmLoading={commentSubmitting}
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
