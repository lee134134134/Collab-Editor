import { ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Col, Empty, Row, Skeleton, Statistic } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  type DashboardStatItem,
  fetchDashboardStats,
} from '@/services/self/dashboard';

const Dashboard: React.FC = () => {
  const [items, setItems] = useState<DashboardStatItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchDashboardStats();
      setItems(data.items);
    } catch {
      // 错误提示由 errorConfig 统一处理
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <PageContainer title="工作台">
      <Card
        loading={false}
        extra={
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={load}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : items.length ? (
          <Row gutter={[16, 16]}>
            {items.map((item) => (
              <Col key={item.label} xs={12} sm={8} md={6}>
                <Card variant="borderless">
                  <Statistic title={item.label} value={item.value} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无统计数据" />
        )}
      </Card>
    </PageContainer>
  );
};

export default Dashboard;
