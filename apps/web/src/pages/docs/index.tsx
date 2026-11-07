import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import {
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  message,
  Popconfirm,
  Spin,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import type { DocMeta } from '@/services/docs';
import { createDoc, deleteDoc, listDocs, updateDoc } from '@/services/docs';

const { Search } = Input;

const Docs: React.FC = () => {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [renameDoc, setRenameDoc] = useState<DocMeta | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listDocs();
      setDocs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return docs;
    return docs.filter((d) => d.title.toLowerCase().includes(k));
  }, [docs, keyword]);

  const handleCreate = async () => {
    try {
      const doc = await createDoc({ title: '未命名文档' });
      message.success('创建成功');
      history.push(`/docs/${doc.id}`);
    } catch {
      // requestErrorConfig 已弹错误提示
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(id);
      message.success('已删除');
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // requestErrorConfig 已弹错误提示
    }
  };

  const openRename = (doc: DocMeta) => {
    setRenameDoc(doc);
    setRenameTitle(doc.title);
  };

  const handleRename = async () => {
    if (!renameDoc) return;
    const title = renameTitle.trim();
    if (!title) {
      message.warning('标题不能为空');
      return;
    }
    setRenameLoading(true);
    try {
      const updated = await updateDoc(renameDoc.id, { title });
      message.success('重命名成功');
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setRenameDoc(null);
    } catch {
      // requestErrorConfig 已弹错误提示
    } finally {
      setRenameLoading(false);
    }
  };

  return (
    <Card
      variant="borderless"
      title="文档库"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建文档
        </Button>
      }
    >
      <Search
        placeholder="搜索文档标题"
        allowClear
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 360 }}
      />

      {loading ? (
        <Spin description="加载中..." />
      ) : (
        <List
          dataSource={filtered}
          locale={{
            emptyText: <Empty description="暂无文档，点击右上角新建" />,
          }}
          renderItem={(doc) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  onClick={() => history.push(`/docs/${doc.id}`)}
                >
                  打开
                </Button>,
                <Button
                  key="rename"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openRename(doc)}
                >
                  重命名
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确认删除？"
                  description="删除后无法恢复"
                  onConfirm={() => handleDelete(doc.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                title={
                  <Typography.Link
                    onClick={() => history.push(`/docs/${doc.id}`)}
                  >
                    {doc.title}
                  </Typography.Link>
                }
                description={`更新于 ${dayjs(doc.updatedAt).format(
                  'YYYY-MM-DD HH:mm',
                )}`}
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        title="重命名文档"
        open={!!renameDoc}
        onOk={handleRename}
        onCancel={() => setRenameDoc(null)}
        confirmLoading={renameLoading}
      >
        <Input
          value={renameTitle}
          onChange={(e) => setRenameTitle(e.target.value)}
          placeholder="请输入文档标题"
          onPressEnter={handleRename}
        />
      </Modal>
    </Card>
  );
};

export default Docs;
