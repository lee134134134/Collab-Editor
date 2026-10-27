import { request } from '@umijs/max';

export interface DashboardStatItem {
  label: string;
  value: string | number;
}

export interface DashboardStats {
  items: DashboardStatItem[];
}

/** 获取工作台统计数据（GET /api/dashboard/stats） */
export async function fetchDashboardStats() {
  return request<DashboardStats>('/api/dashboard/stats');
}
