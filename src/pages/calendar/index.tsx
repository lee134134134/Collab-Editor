import { PageContainer } from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Switch,
} from 'antd';
import type { Temporal } from 'temporal-polyfill';
import 'temporal-polyfill/global';
import type { CalendarApp } from '@schedule-x/calendar';
import {
  createViewDay,
  createViewList,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react';
import dayjs from 'dayjs';
import '@schedule-x/theme-default/dist/index.css';
import React, { useEffect, useRef, useState } from 'react';
import {
  type CalendarEventInput,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  updateCalendarEvent,
} from '@/services/self/calendar';
import {
  CALENDAR_IDS,
  CALENDAR_LABELS,
  isTimedEvent,
  LOCAL_TIME_ZONE,
  toScheduleXEvent,
  toZonedDateTime,
} from '@/utils/calendar';

const eventsService = createEventsServicePlugin();

interface CalendarFormValues {
  title: string;
  calendarId: (typeof CALENDAR_IDS)[number];
  allDay: boolean;
  dateRange?: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
  dateTimeRange?: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
  location?: string;
  description?: string;
}

const DEFAULT_FORM: CalendarFormValues = {
  title: '',
  calendarId: 'default',
  allDay: false,
  dateRange: null,
  dateTimeRange: null,
  location: '',
  description: '',
};

/** 事件点击对象（Schedule-X 回调入参的裁剪视图） */
interface ClickedEvent {
  id: string | number;
  title?: string;
  start: Temporal.ZonedDateTime | Temporal.PlainDate;
  end: Temporal.ZonedDateTime | Temporal.PlainDate;
  description?: string;
  location?: string;
  calendarId?: string;
}

const CalendarPage: React.FC = () => {
  const { message, modal } = App.useApp();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<CalendarFormValues>();
  const allDay = Form.useWatch('allDay', form) ?? false;

  /* ---------- 稳定引用（日历回调经由 ref 调用，避免闭包过期） ---------- */
  const openCreateRef =
    useRef<(source?: Temporal.PlainDate | Temporal.ZonedDateTime) => void>(
      undefined,
    );
  const openEditRef = useRef<(event: ClickedEvent) => void>(undefined);

  /** 当前视图范围（onRangeUpdate 记录，供增删改后刷新使用） */
  const currentRangeRef = useRef<{ start: string; end: string } | null>(null);
  const calendarRef = useRef<CalendarApp | null>(null);

  /* ---------- 新建 / 编辑弹窗 ---------- */

  const resetForm = () => {
    form.resetFields();
  };

  const openCreate = (source?: Temporal.PlainDate | Temporal.ZonedDateTime) => {
    setEditingId(null);
    resetForm();
    if (source) {
      if (isTimedEvent(source)) {
        form.setFieldsValue({
          allDay: false,
          dateTimeRange: [
            dayjs(source.epochMilliseconds),
            dayjs(source.epochMilliseconds),
          ],
        });
      } else {
        form.setFieldsValue({
          allDay: true,
          dateRange: [dayjs(source.toString()), dayjs(source.toString())],
        });
      }
    }
    setOpen(true);
  };

  const openEdit = (event: ClickedEvent) => {
    setEditingId(String(event.id));
    resetForm();
    const { start, end } = event;
    if (isTimedEvent(start) && isTimedEvent(end)) {
      form.setFieldsValue({
        title: event.title ?? '',
        calendarId:
          (event.calendarId as CalendarFormValues['calendarId']) ?? 'default',
        allDay: false,
        dateTimeRange: [
          dayjs(start.epochMilliseconds),
          dayjs(end.epochMilliseconds),
        ],
        location: event.location ?? '',
        description: event.description ?? '',
      });
    } else {
      form.setFieldsValue({
        title: event.title ?? '',
        calendarId:
          (event.calendarId as CalendarFormValues['calendarId']) ?? 'default',
        allDay: true,
        dateRange: [dayjs(start.toString()), dayjs(end.toString())],
        location: event.location ?? '',
        description: event.description ?? '',
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    openCreateRef.current = openCreate;
    openEditRef.current = openEdit;
  });

  /* ---------- 保存 / 删除 ---------- */

  const buildPayload = (
    values: CalendarFormValues,
  ): CalendarEventInput | null => {
    const title = values.title?.trim();
    if (!title) {
      message.warning('请输入日程标题');
      return null;
    }
    if (values.allDay) {
      const range = values.dateRange;
      if (!range?.[0] || !range?.[1]) {
        message.warning('请选择日期范围');
        return null;
      }
      return {
        title,
        start: range[0].format('YYYY-MM-DD'),
        end: range[1].format('YYYY-MM-DD'),
        description: values.description,
        location: values.location,
        all_day: true,
        calendar_id: values.calendarId,
      };
    }
    const range = values.dateTimeRange;
    if (!range?.[0] || !range?.[1]) {
      message.warning('请选择时间范围');
      return null;
    }
    return {
      title,
      start: toZonedDateTime(range[0].toDate()).toString(),
      end: toZonedDateTime(range[1].toDate()).toString(),
      description: values.description,
      location: values.location,
      all_day: false,
      calendar_id: values.calendarId,
    };
  };

  const loadAndSetEvents = async (start: string, end: string) => {
    const data = await fetchCalendarEvents(start, end);
    eventsService.set(data.items.map(toScheduleXEvent));
  };

  const refreshEvents = async () => {
    const range = currentRangeRef.current;
    if (!range) return;
    try {
      await loadAndSetEvents(range.start, range.end);
    } catch {
      // 错误提示由 errorConfig 统一处理
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = buildPayload(values);
    if (!payload) return;

    try {
      if (editingId) {
        await updateCalendarEvent(editingId, payload);
        message.success('日程已更新');
      } else {
        await createCalendarEvent(payload);
        message.success('日程已创建');
      }
      setOpen(false);
      await refreshEvents();
    } catch {
      // 错误提示由 errorConfig 统一处理
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    modal.confirm({
      title: '确定删除该日程吗？',
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteCalendarEvent(editingId);
          message.success('日程已删除');
          setOpen(false);
          await refreshEvents();
        } catch {
          // 错误提示由 errorConfig 统一处理
        }
      },
    });
  };

  /* ---------- 日历实例（结构与 Vue 版 createCalendar 配置对等） ---------- */

  const calendar = useCalendarApp(
    {
      locale: 'zh-CN',
      timezone: LOCAL_TIME_ZONE,
      firstDayOfWeek: 1,
      views: [
        createViewMonthGrid(),
        createViewWeek(),
        createViewDay(),
        createViewMonthAgenda(),
        createViewList(),
      ],
      calendars: {
        default: {
          colorName: 'default',
          lightColors: {
            main: '#409eff',
            container: '#ecf5ff',
            onContainer: '#337ecc',
          },
        },
        work: {
          colorName: 'work',
          lightColors: {
            main: '#f91c45',
            container: '#ffd2dc',
            onContainer: '#59000d',
          },
        },
        personal: {
          colorName: 'personal',
          lightColors: {
            main: '#1cf9b0',
            container: '#dafff0',
            onContainer: '#004d3d',
          },
        },
      },
      callbacks: {
        async fetchEvents(range) {
          const data = await fetchCalendarEvents(
            String(range.start),
            String(range.end),
          );
          return data.items.map(toScheduleXEvent);
        },
        onRangeUpdate(range) {
          currentRangeRef.current = {
            start: String(range.start),
            end: String(range.end),
          };
        },
        onEventClick(event) {
          openEditRef.current?.(event as ClickedEvent);
        },
        onClickDate(date) {
          openCreateRef.current?.(date);
        },
        onClickDateTime(dateTime) {
          openCreateRef.current?.(dateTime);
        },
      },
    },
    [eventsService],
  );

  useEffect(() => {
    calendarRef.current = calendar;
    return () => {
      calendarRef.current?.destroy?.();
      calendarRef.current = null;
      currentRangeRef.current = null;
    };
  }, [calendar]);

  const isEditing = Boolean(editingId);

  return (
    <PageContainer
      title="日程日历"
      extra={[
        <Button key="create" type="primary" onClick={() => openCreate()}>
          新建日程
        </Button>,
      ]}
    >
      <Card styles={{ body: { padding: 12 } }}>
        <div style={{ minHeight: 560, height: 'calc(100vh - 260px)' }}>
          <ScheduleXCalendar calendarApp={calendar} />
        </div>
      </Card>

      <Modal
        title={editingId ? '编辑日程' : '新建日程'}
        width={640}
        open={open}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>
            取消
          </Button>,
          ...(isEditing
            ? [
                <Button key="delete" danger onClick={handleDelete}>
                  删除
                </Button>,
              ]
            : []),
          <Button key="save" type="primary" onClick={handleSave}>
            保存
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_FORM}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入日程标题' }]}
          >
            <Input maxLength={100} placeholder="请输入日程标题" />
          </Form.Item>

          <Form.Item
            name="calendarId"
            label="分类"
            rules={[{ required: true }]}
          >
            <Select>
              {CALENDAR_IDS.map((id) => (
                <Select.Option key={id} value={id}>
                  {CALENDAR_LABELS[id]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="allDay" label="全天" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="日期"
            hidden={!allDay}
            rules={[{ required: allDay, message: '请选择日期范围' }]}
          >
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="dateTimeRange"
            label="时间"
            hidden={allDay}
            rules={[{ required: !allDay, message: '请选择时间范围' }]}
          >
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="location" label="地点">
            <Input maxLength={200} placeholder="请输入地点" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea
              rows={3}
              maxLength={1000}
              placeholder="请输入描述"
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default CalendarPage;
