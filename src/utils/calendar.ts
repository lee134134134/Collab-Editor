import type { CalendarEventExternal } from '@schedule-x/calendar';
import { Temporal } from 'temporal-polyfill';
import type { CalendarEvent } from '@/services/self/calendar';

/** 浏览器本地时区 */
export const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** 后端日程 → Schedule-X 日历事件（全日事件用 PlainDate，定时事件用本地 ZonedDateTime） */
export function toScheduleXEvent(event: CalendarEvent): CalendarEventExternal {
  const isAllDay = Boolean(event.all_day);
  return {
    id: event.id,
    title: event.title,
    start: isAllDay
      ? Temporal.PlainDate.from(event.start)
      : Temporal.ZonedDateTime.from(event.start),
    end: isAllDay
      ? Temporal.PlainDate.from(event.end)
      : Temporal.ZonedDateTime.from(event.end),
    description: event.description,
    location: event.location,
    calendarId: event.calendar_id || 'default',
  };
}

/** JS Date → Temporal.ZonedDateTime（本地时区） */
export function toZonedDateTime(date: Date): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(
    date.getTime(),
  ).toZonedDateTimeISO(LOCAL_TIME_ZONE);
}

/** 判断是否为定时事件（ZonedDateTime 含 hour 属性，PlainDate 无） */
export function isTimedEvent(
  value: Temporal.ZonedDateTime | Temporal.PlainDate,
): value is Temporal.ZonedDateTime {
  return 'hour' in value;
}

/** Calendar 分类（对应后端 calendar_id 与日历颜色配置） */
export const CALENDAR_IDS = ['default', 'work', 'personal'] as const;
export const CALENDAR_LABELS: Record<string, string> = {
  default: '默认',
  work: '工作',
  personal: '个人',
};
