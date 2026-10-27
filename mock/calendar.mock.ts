/**
 * 日程日历 mock（npm start 开启 mock 时生效）
 * 内存数组实现 CRUD，与真实后端契约一致：
 * - start/end 字符串：全日 'YYYY-MM-DD'，定时为 Temporal ZonedDateTime toString
 * - 查询参数 from/to 为日期或日期时间字符串，过滤与日程存在交集的记录（简化为区间比较）
 */
interface MockEvent {
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

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const now = new Date();
const Y = now.getFullYear();
const M = pad(now.getMonth() + 1);
const day = (d: number, h = 9, m = 0) =>
  `${Y}-${M}-${pad(d)} ${pad(h)}:${pad(m)}:00`;
const date = (d: number) => `${Y}-${M}-${pad(d)}`;

let events: MockEvent[] = [
  {
    id: 'mock-1',
    title: '周会',
    start: `${date(2)} 10:00:00`,
    end: `${date(2)} 11:30:00`,
    description: '每周例会',
    location: '会议室 A',
    all_day: false,
    calendar_id: 'work',
  },
  {
    id: 'mock-2',
    title: '版本发布日',
    start: date(5),
    end: date(5),
    all_day: true,
    calendar_id: 'work',
  },
  {
    id: 'mock-3',
    title: ' dentist 视力复查',
    start: `${date(8)} 14:30:00`,
    end: `${date(8)} 15:30:00`,
    location: '眼科诊所',
    all_day: false,
    calendar_id: 'personal',
  },
  {
    id: 'mock-4',
    title: 'RAG 项目评审',
    start: `${date(11)} 15:00:00`,
    end: `${date(11)} 17:00:00`,
    description: '检索效果一轮评审',
    all_day: false,
    calendar_id: 'work',
  },
  {
    id: 'mock-5',
    title: '团建',
    start: date(15),
    end: date(16),
    all_day: true,
    calendar_id: 'default',
  },
  {
    id: 'mock-6',
    title: '复盘会',
    start: `${date(20)} 18:00:00`,
    end: `${date(20)} 19:00:00`,
    all_day: false,
    calendar_id: 'default',
  },
];

export default {
  'GET /api/calendar/events': (req: any, res: any) => {
    const { from, to } = req.query ?? {};
    let list = events;
    if (from) list = list.filter((e) => e.end.replace(' ', 'T') >= from);
    if (to) list = list.filter((e) => e.start.replace(' ', 'T') <= to);
    res.json({ items: list });
  },
  'POST /api/calendar/events': (req: any, res: any) => {
    const body = req.body ?? {};
    const event: MockEvent = {
      ...body,
      id: `mock-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    events.push(event);
    res.json(event);
  },
  'PUT /api/calendar/events/:id': (req: any, res: any) => {
    const { id } = req.params ?? {};
    const idx = events.findIndex((e) => e.id === id);
    if (idx < 0) {
      res.status(404).json({ message: '日程不存在' });
      return;
    }
    events[idx] = {
      ...events[idx],
      ...req.body,
      id,
      updated_at: new Date().toISOString(),
    };
    res.json(events[idx]);
  },
  'DELETE /api/calendar/events/:id': (req: any, res: any) => {
    const { id } = req.params ?? {};
    events = events.filter((e) => e.id !== id);
    res.json({ message: '删除成功' });
  },
};
