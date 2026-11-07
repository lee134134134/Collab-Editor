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
import { Button, Select, Space, Tooltip } from 'antd';
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

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  const headingValue = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
      ? '2'
      : editor.isActive('heading', { level: 3 })
        ? '3'
        : editor.isActive('heading', { level: 4 })
          ? '4'
          : editor.isActive('heading', { level: 5 })
            ? '5'
            : editor.isActive('heading', { level: 6 })
              ? '6'
              : '0';

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
    <Space wrap className="doc-editor__toolbar">
      <Tooltip title="撤销">
        <Button
          icon={<UndoOutlined />}
          onClick={() => editor.commands.undo()}
          disabled={!editor.can().undo()}
        />
      </Tooltip>
      <Tooltip title="重做">
        <Button
          icon={<RedoOutlined />}
          onClick={() => editor.commands.redo()}
          disabled={!editor.can().redo()}
        />
      </Tooltip>
      <Tooltip title="粗体">
        <Button
          icon={<BoldOutlined />}
          type={editor.isActive('bold') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
      </Tooltip>
      <Tooltip title="斜体">
        <Button
          icon={<ItalicOutlined />}
          type={editor.isActive('italic') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
      </Tooltip>
      <Tooltip title="删除线">
        <Button
          icon={<StrikethroughOutlined />}
          type={editor.isActive('strike') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
      </Tooltip>
      <Tooltip title="行内代码">
        <Button
          icon={<CodeOutlined />}
          type={editor.isActive('code') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
      </Tooltip>
      <Select
        value={headingValue}
        options={headingOptions}
        onChange={toggleHeading}
        style={{ width: 100 }}
      />
      <Tooltip title="无序列表">
        <Button
          icon={<UnorderedListOutlined />}
          type={editor.isActive('bulletList') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
      </Tooltip>
      <Tooltip title="有序列表">
        <Button
          icon={<OrderedListOutlined />}
          type={editor.isActive('orderedList') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </Tooltip>
      <Tooltip title="引用">
        <Button
          icon={<BlockOutlined />}
          type={editor.isActive('blockquote') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
      </Tooltip>
      <Tooltip title="代码块">
        <Button
          icon={<CodeOutlined />}
          type={editor.isActive('codeBlock') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
      </Tooltip>
      <Tooltip title="链接">
        <Button icon={<LinkOutlined />} onClick={setLink} />
      </Tooltip>
      <Tooltip title="表格">
        <Button icon={<TableOutlined />} onClick={insertTable} />
      </Tooltip>
      <Tooltip title="分割线">
        <Button
          icon={<MinusOutlined />}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </Tooltip>
    </Space>
  );
};
