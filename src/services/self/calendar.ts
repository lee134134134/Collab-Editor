import { request } from '@umijs/max';

/** 日程事件（后端存储格式；start/end 为字符串：全日 'YYYY-MM-DD'，定时为 Temporal ZonedDateTime toString） */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  all_day?: boolean;
  calendar_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEventsResponse {
  items: CalendarEvent[];
}

export interface CalendarEventInput {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  all_day?: boolean;
  calendar_id?: string;
}

/** 查询日程列表（from/to 为日期或日期时间字符串，可选） */
export async function fetchCalendarEvents(from: string, to: string) {
  return request<CalendarEventsResponse>('/api/calendar/events', {
    params: { from, to },
  });
}

/** 创建日程 */
export async function createCalendarEvent(data: CalendarEventInput) {
  return request<CalendarEvent>('/api/calendar/events', { method: 'POST', data });
}

/** 更新日程（部分字段） */
export async function updateCalendarEvent(
  id: string,
  data: Partial<CalendarEventInput>,
) {
  return request<CalendarEvent>(`/api/calendar/events/${id}`, {
    method: 'PUT',
    data,
  });
}

/** 删除日程 */
export async function deleteCalendarEvent(id: string) {
  return request<{ message: string }>(`/api/calendar/events/${id}`, {
    method: 'DELETE',
  });
}
