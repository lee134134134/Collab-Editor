import {
  BlockOutlined,
  BoldOutlined,
  CodeOutlined,
  ItalicOutlined,
  LinkOutlined,
  MinusOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Button, Select, Tooltip } from 'antd';
import React from 'react';

interface EditorToolbarProps {
  editor: Editor;
}

const headingOptions = [
  { value: '0', label: '正文' },
  { value: '1', label: '标题 1' },
  { value: '2', label: '标题 2' },
  { value: '3', label: '标题 3' },
  { value: '4', label: '标题 4' },
  { value: '5', label: '标题 5' },
  { value: '6', label: '标题 6' },
];

const headingLevels = [1, 2, 3, 4, 5, 6] as const;

interface ToolButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

/** 图标工具按钮：Tooltip + aria-label 双通道可访问名称，active 用浅底强调 */
const ToolButton: React.FC<ToolButtonProps> = ({
  label,
  icon,
  onClick,
  active,
  disabled,
}) => (
  <Tooltip title={label} mouseEnterDelay={0.4}>
    <Button
      type="text"
      size="small"
      className={`doc-editor__toolbar-btn${
        active ? ' doc-editor__toolbar-btn--active' : ''
      }`}
      icon={icon}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    />
  </Tooltip>
);

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  // useEditorState 订阅选区/文档变化，避免 active 态在 Tiptap 3 下不刷新
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading:
        headingLevels.find((level) => e.isActive('heading', { level })) ?? 0,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const toggleHeading = (value: string) => {
    if (value === '0') {
      editor.chain().focus().setParagraph().run();
    } else {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
        .run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('请输入链接地址', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="doc-editor__toolbar" role="toolbar" aria-label="格式工具栏">
      <div className="doc-editor__tool-group">
        <ToolButton
          label="撤销"
          icon={<UndoOutlined />}
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          label="重做"
          icon={<RedoOutlined />}
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      <span className="doc-editor__tool-divider" aria-hidden="true" />

      <div className="doc-editor__tool-group">
        <ToolButton
          label="粗体"
          icon={<BoldOutlined />}
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolButton
          label="斜体"
          icon={<ItalicOutlined />}
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolButton
          label="删除线"
          icon={<StrikethroughOutlined />}
          active={state.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolButton
          label="行内代码"
          icon={<CodeOutlined />}
          active={state.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
      </div>

      <span className="doc-editor__tool-divider" aria-hidden="true" />

      <div className="doc-editor__tool-group">
        <Select
          className="doc-editor__heading-select"
          aria-label="段落样式"
          size="small"
          value={String(state.heading)}
          options={headingOptions}
          onChange={toggleHeading}
          popupMatchSelectWidth={120}
        />
        <ToolButton
          label="无序列表"
          icon={<UnorderedListOutlined />}
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          label="有序列表"
          icon={<OrderedListOutlined />}
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          label="引用"
          icon={<BlockOutlined />}
          active={state.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          label="代码块"
          icon={<CodeOutlined />}
          active={state.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
      </div>

      <span className="doc-editor__tool-divider" aria-hidden="true" />

      <div className="doc-editor__tool-group">
        <ToolButton
          label="链接"
          icon={<LinkOutlined />}
          active={state.link}
          onClick={setLink}
        />
        <ToolButton
          label="插入表格"
          icon={<TableOutlined />}
          onClick={insertTable}
        />
        <ToolButton
          label="分割线"
          icon={<MinusOutlined />}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>
    </div>
  );
};
