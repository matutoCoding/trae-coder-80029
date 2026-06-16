import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Spin,
  Tooltip,
  Card,
} from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import type { CalendarProps } from 'antd';
import { api } from '@/lib/api';
import { Bench, TimeSlot, SlotStatus, ApiResponse } from 'shared/types';

const { Title } = Typography;
const { Option } = Select;

const STATUS_COLORS: Record<SlotStatus, string> = {
  available: '#52c41a',
  booked: '#1677ff',
  occupied: '#fa8c16',
  maintenance: '#8c8c8c',
};

const STATUS_LABELS: Record<SlotStatus, string> = {
  available: '可用',
  booked: '已约',
  occupied: '使用中',
  maintenance: '维护',
};

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface DateStats {
  available: number;
  booked: number;
  occupied: number;
  maintenance: number;
}

interface SlotWithBench extends TimeSlot {
  benchName: string;
}

export default function ScheduleCalendar() {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [weekStart, setWeekStart] = useState<Dayjs>(
    dayjs().startOf('week').add(1, 'day')
  );
  const [benches, setBenches] = useState<Bench[]>([]);
  const [selectedBenchIds, setSelectedBenchIds] = useState<number[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [allSlots, setAllSlots] = useState<SlotWithBench[]>([]);

  const weekEnd = useMemo(() => weekStart.add(6, 'day'), [weekStart]);

  const weekDates = useMemo(() => {
    const dates: Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(weekStart.add(i, 'day'));
    }
    return dates;
  }, [weekStart]);

  const filteredBenches = useMemo(() => {
    if (selectedBenchIds.length === 0) return benches;
    return benches.filter((b) => selectedBenchIds.includes(b.id));
  }, [benches, selectedBenchIds]);

  const filteredSlots = useMemo(() => {
    if (selectedBenchIds.length === 0) return allSlots;
    return allSlots.filter((s) => selectedBenchIds.includes(s.benchId));
  }, [allSlots, selectedBenchIds]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, SlotWithBench[]> = {};
    for (const s of filteredSlots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [filteredSlots]);

  const dateStatsMap = useMemo(() => {
    const map: Record<string, DateStats> = {};
    for (const s of filteredSlots) {
      if (!map[s.date]) {
        map[s.date] = { available: 0, booked: 0, occupied: 0, maintenance: 0 };
      }
      map[s.date][s.status]++;
    }
    return map;
  }, [filteredSlots]);

  const loadBenches = async () => {
    try {
      const res = await api.get<ApiResponse<Bench[]>>('/benches');
      if (res.success && res.data) {
        setBenches(res.data);
      }
    } catch {
      // ignore
    }
  };

  const loadSlots = async (startDate: Dayjs, endDate: Dayjs) => {
    if (filteredBenches.length === 0) {
      setAllSlots([]);
      return;
    }

    setSlotsLoading(true);
    try {
      const startStr = startDate.format('YYYY-MM-DD');
      const endStr = endDate.format('YYYY-MM-DD');

      const promises = filteredBenches.map((bench) =>
        api.get<ApiResponse<TimeSlot[]>>(`/benches/${bench.id}/slots`, {
          params: { startDate: startStr, endDate: endStr },
        })
      );

      const results = await Promise.all(promises);
      const benchMap = new Map(benches.map((b) => [b.id, b.name]));

      const slots: SlotWithBench[] = [];
      for (const res of results) {
        if (res.success && res.data) {
          for (const slot of res.data) {
            slots.push({
              ...slot,
              benchName: benchMap.get(slot.benchId) || '未知实验台',
            });
          }
        }
      }

      setAllSlots(slots);
    } catch {
      // ignore
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    loadBenches();
  }, []);

  useEffect(() => {
    if (benches.length === 0) return;

    if (viewMode === 'month') {
      const monthStart = currentDate.startOf('month');
      const monthEnd = currentDate.endOf('month');
      const calendarStart = monthStart.startOf('week').add(1, 'day');
      const calendarEnd = monthEnd.endOf('week').add(1, 'day');
      loadSlots(calendarStart, calendarEnd);
    } else {
      loadSlots(weekStart, weekEnd);
    }
  }, [viewMode, currentDate, weekStart, selectedBenchIds, benches]);

  const handlePanelChange: CalendarProps<Dayjs>['onPanelChange'] = (
    value,
    mode
  ) => {
    if (mode === 'month') {
      setCurrentDate(value);
    }
  };

  const handleSelect: CalendarProps<Dayjs>['onSelect'] = (value) => {
    setCurrentDate(value);
  };

  const handlePrevWeek = () => {
    setWeekStart(weekStart.subtract(7, 'day'));
  };

  const handleNextWeek = () => {
    setWeekStart(weekStart.add(7, 'day'));
  };

  const handleWeekChange = (value: Dayjs | null) => {
    if (value) {
      setWeekStart(value.startOf('week').add(1, 'day'));
    }
  };

  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD');
    const stats = dateStatsMap[dateStr];
    const daySlots = slotsByDate[dateStr] || [];

    const statuses: SlotStatus[] = ['available', 'booked', 'occupied', 'maintenance'];

    return (
      <div className="min-h-[80px] py-1">
        <div className="flex flex-wrap gap-1 mb-2 justify-center">
          {statuses.map((status) => {
            const count = stats?.[status] || 0;
            if (count === 0) return null;
            return (
              <Tooltip
                key={status}
                title={`${STATUS_LABELS[status]}: ${count}`}
              >
                <div className="flex items-center gap-0.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  <span className="text-xs text-slate-600">{count}</span>
                </div>
              </Tooltip>
            );
          })}
        </div>
        {stats && (
          <div className="text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between px-1">
              <span style={{ color: STATUS_COLORS.available }}>
                可用{stats.available}
              </span>
              <span style={{ color: STATUS_COLORS.booked }}>
                已约{stats.booked}
              </span>
            </div>
            <div className="flex justify-between px-1">
              <span style={{ color: STATUS_COLORS.occupied }}>
                使用中{stats.occupied}
              </span>
              <span style={{ color: STATUS_COLORS.maintenance }}>
                维护{stats.maintenance}
              </span>
            </div>
          </div>
        )}
        {daySlots.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-0.5 justify-center max-h-6 overflow-hidden">
            {daySlots.slice(0, 6).map((slot) => (
              <Tooltip
                key={slot.id}
                title={`${slot.benchName} ${slot.startTime}-${slot.endTime} ${STATUS_LABELS[slot.status]}`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[slot.status] }}
                />
              </Tooltip>
            ))}
            {daySlots.length > 6 && (
              <span className="text-[10px] text-slate-400">+{daySlots.length - 6}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const getSlotStatusStyle = (status: SlotStatus) => {
    const color = STATUS_COLORS[status];
    return {
      backgroundColor: `${color}15`,
      borderLeft: `3px solid ${color}`,
      color,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Title level={3} className="!m-0 !text-slate-800">
          排期总览
        </Title>
        <Space wrap>
          <Select
            mode="multiple"
            placeholder="实验台筛选"
            style={{ minWidth: 240 }}
            value={selectedBenchIds}
            onChange={setSelectedBenchIds}
            allowClear
            maxTagCount="responsive"
          >
            {benches.map((bench) => (
              <Option key={bench.id} value={bench.id}>
                {bench.name}
              </Option>
            ))}
          </Select>
          <Button.Group>
            <Button
              type={viewMode === 'month' ? 'primary' : 'default'}
              onClick={() => setViewMode('month')}
              icon={<CalendarOutlined />}
            >
              月视图
            </Button>
            <Button
              type={viewMode === 'week' ? 'primary' : 'default'}
              onClick={() => setViewMode('week')}
            >
              周视图
            </Button>
          </Button.Group>
        </Space>
      </div>

      <div className="flex flex-wrap gap-4 text-sm mb-2">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-600">
              {STATUS_LABELS[status as SlotStatus]}
            </span>
          </div>
        ))}
      </div>

      <Spin spinning={slotsLoading}>
        {viewMode === 'month' ? (
          <Card className="shadow-sm">
            <Calendar
              value={currentDate}
              onSelect={handleSelect as any}
              onPanelChange={handlePanelChange as any}
              dateCellRender={dateCellRender}
            />
          </Card>
        ) : (
          <Card
            className="shadow-sm"
            title={
              <div className="flex items-center gap-2">
                <CalendarOutlined />
                <span>
                  {weekStart.format('YYYY年MM月DD日')} -{' '}
                  {weekEnd.format('MM月DD日')}
                </span>
              </div>
            }
            extra={
              <Space>
                <Button icon={<LeftOutlined />} onClick={handlePrevWeek}>
                  上一周
                </Button>
                <Button onClick={handleNextWeek}>
                  下一周 <RightOutlined />
                </Button>
              </Space>
            }
          >
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, idx) => {
                const dateStr = date.format('YYYY-MM-DD');
                const isToday = date.isSame(dayjs(), 'day');
                const daySlots = slotsByDate[dateStr] || [];

                const slotsByBench: Record<number, SlotWithBench[]> = {};
                for (const s of daySlots) {
                  if (!slotsByBench[s.benchId]) slotsByBench[s.benchId] = [];
                  slotsByBench[s.benchId].push(s);
                }

                return (
                  <div key={dateStr} className="min-w-0">
                    <div
                      className={`text-center py-2 px-1 rounded-t-lg text-sm font-medium border-b-2 ${
                        isToday
                          ? 'bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div>{WEEKDAYS[idx]}</div>
                      <div className="text-xs opacity-75">
                        {date.format('MM/DD')}
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-2 min-h-[400px] max-h-[600px] overflow-y-auto">
                      {Object.keys(slotsByBench).length === 0 ? (
                        <div className="text-xs text-slate-300 text-center py-8">
                          无时段
                        </div>
                      ) : (
                        Object.entries(slotsByBench).map(([benchId, benchSlots]) =>
                          benchSlots.map((slot) => (
                            <Tooltip
                              key={slot.id}
                              title={`${slot.benchName} ${slot.startTime}-${slot.endTime} 点击查看详情`}
                            >
                              <div
                                onClick={() => navigate(`/benches/${benchId}`)}
                                className="rounded-md px-2 py-1.5 text-xs leading-tight cursor-pointer hover:scale-[1.02] hover:shadow-sm transition-all"
                                style={getSlotStatusStyle(slot.status)}
                              >
                                <div className="font-medium truncate">
                                  {slot.benchName}
                                </div>
                                <div className="font-mono opacity-75">
                                  {slot.startTime} - {slot.endTime}
                                </div>
                                <Tag
                                  color={slot.status === 'available' ? 'green' : slot.status === 'booked' ? 'blue' : slot.status === 'occupied' ? 'orange' : 'default'}
                                  className="!mt-1 !mb-0 !text-[10px] !py-0"
                                >
                                  {STATUS_LABELS[slot.status]}
                                </Tag>
                              </div>
                            </Tooltip>
                          ))
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </Spin>
    </div>
  );
}
