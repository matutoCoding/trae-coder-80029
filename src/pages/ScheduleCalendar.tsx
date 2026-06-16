import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Modal,
  Popover,
  Progress,
} from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import type { CalendarProps } from 'antd';
import { api } from '@/lib/api';
import { Bench, TimeSlot, SlotStatus, ApiResponse, Booking } from 'shared/types';

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

interface HeatmapCell {
  total: number;
  booked: number;
  occupied: number;
  maintenance: number;
  utilizationRate: number;
  maintenanceRate: number;
  peakTime: string | null;
}

type ViewMode = 'month' | 'week' | 'heatmap';

export default function ScheduleCalendar() {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [weekStart, setWeekStart] = useState<Dayjs>(
    dayjs().startOf('week').add(1, 'day')
  );
  const [benches, setBenches] = useState<Bench[]>([]);
  const [selectedBenchIds, setSelectedBenchIds] = useState<number[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [allSlots, setAllSlots] = useState<SlotWithBench[]>([]);

  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    benchId: number;
    benchName: string;
    weekStart: Dayjs;
    weekEnd: Dayjs;
    weekLabel: string;
  }>({
    visible: false,
    benchId: 0,
    benchName: '',
    weekStart: dayjs(),
    weekEnd: dayjs(),
    weekLabel: '',
  });
  const [detailSlots, setDetailSlots] = useState<SlotWithBench[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bookingTitles, setBookingTitles] = useState<Record<number, string>>({});

  const weekEnd = useMemo(() => weekStart.add(6, 'day'), [weekStart]);

  const weekDates = useMemo(() => {
    const dates: Dayjs[] = [];
    for (let i = 0; i < 7; i++) dates.push(weekStart.add(i, 'day'));
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
    for (const k of Object.keys(map))
      map[k].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [filteredSlots]);

  const dateStatsMap = useMemo(() => {
    const map: Record<string, DateStats> = {};
    for (const s of filteredSlots) {
      if (!map[s.date])
        map[s.date] = { available: 0, booked: 0, occupied: 0, maintenance: 0 };
      map[s.date][s.status]++;
    }
    return map;
  }, [filteredSlots]);

  const heatmapWeeks = useMemo(() => {
    const monthStart = currentDate.startOf('month');
    const monthEnd = currentDate.endOf('month');
    let ws = monthStart.startOf('week').add(1, 'day');
    if (ws.isAfter(monthStart)) ws = ws.subtract(7, 'day');
    const weeks: { label: string; start: Dayjs; end: Dayjs }[] = [];
    let n = 1;
    while (ws.isBefore(monthEnd) || ws.isSame(monthEnd, 'day')) {
      weeks.push({ label: `W${n}`, start: ws, end: ws.add(6, 'day') });
      ws = ws.add(7, 'day');
      n++;
    }
    return weeks;
  }, [currentDate]);

  const heatmapData = useMemo(() => {
    const data: Record<number, Record<string, HeatmapCell>> = {};
    for (const bench of filteredBenches) {
      data[bench.id] = {};
      for (const week of heatmapWeeks) {
        const ss = week.start.format('YYYY-MM-DD');
        const se = week.end.format('YYYY-MM-DD');
        const ws = filteredSlots.filter(
          (s) => s.benchId === bench.id && s.date >= ss && s.date <= se
        );
        const total = ws.length;
        const booked = ws.filter((s) => s.status === 'booked').length;
        const occupied = ws.filter((s) => s.status === 'occupied').length;
        const maintenance = ws.filter((s) => s.status === 'maintenance').length;
        const timeCounts: Record<string, number> = {};
        for (const s of ws) {
          if (s.status === 'booked' || s.status === 'occupied') {
            const key = `${s.startTime}-${s.endTime}`;
            timeCounts[key] = (timeCounts[key] || 0) + 1;
          }
        }
        let peakTime: string | null = null;
        let maxC = 0;
        for (const [t, c] of Object.entries(timeCounts)) {
          if (c > maxC) {
            maxC = c;
            peakTime = t;
          }
        }
        data[bench.id][week.label] = {
          total,
          booked,
          occupied,
          maintenance,
          utilizationRate: total > 0 ? ((booked + occupied) / total) * 100 : 0,
          maintenanceRate: total > 0 ? (maintenance / total) * 100 : 0,
          peakTime,
        };
      }
    }
    return data;
  }, [filteredBenches, filteredSlots, heatmapWeeks]);

  const heatmapSummary = useMemo(() => {
    const summary: Record<number, HeatmapCell> = {};
    for (const bench of filteredBenches) {
      const bs = filteredSlots.filter((s) => s.benchId === bench.id);
      const total = bs.length;
      const booked = bs.filter((s) => s.status === 'booked').length;
      const occupied = bs.filter((s) => s.status === 'occupied').length;
      const maintenance = bs.filter((s) => s.status === 'maintenance').length;
      summary[bench.id] = {
        total,
        booked,
        occupied,
        maintenance,
        utilizationRate: total > 0 ? ((booked + occupied) / total) * 100 : 0,
        maintenanceRate: total > 0 ? (maintenance / total) * 100 : 0,
        peakTime: null,
      };
    }
    return summary;
  }, [filteredBenches, filteredSlots]);

  const loadBenches = async () => {
    try {
      const res = await api.get<ApiResponse<Bench[]>>('/benches');
      if (res.success && res.data) setBenches(res.data);
    } catch {}
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
      const results = await Promise.all(
        filteredBenches.map((bench) =>
          api.get<ApiResponse<TimeSlot[]>>(`/benches/${bench.id}/slots`, {
            params: { startDate: startStr, endDate: endStr },
          })
        )
      );
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
    } catch {} finally {
      setSlotsLoading(false);
    }
  };

  const loadDetailSlots = useCallback(
    async (benchId: number, ws: Dayjs, we: Dayjs) => {
      setDetailLoading(true);
      try {
        const res = await api.get<ApiResponse<TimeSlot[]>>(
          `/benches/${benchId}/slots`,
          {
            params: {
              startDate: ws.format('YYYY-MM-DD'),
              endDate: we.format('YYYY-MM-DD'),
            },
          }
        );
        if (res.success && res.data) {
          const slots = res.data.filter(
            (s) => s.status === 'booked' || s.status === 'occupied'
          );
          const benchName =
            benches.find((b) => b.id === benchId)?.name || '未知实验台';
          setDetailSlots(slots.map((s) => ({ ...s, benchName })));
          const bookingIds = [
            ...new Set(slots.filter((s) => s.bookingId).map((s) => s.bookingId!)),
          ];
          const titles: Record<number, string> = {};
          await Promise.all(
            bookingIds.map(async (id) => {
              try {
                const br = await api.get<ApiResponse<Booking>>(
                  `/bookings/${id}`
                );
                if (br.success && br.data) titles[id] = br.data.title;
              } catch {}
            })
          );
          setBookingTitles(titles);
        }
      } catch {} finally {
        setDetailLoading(false);
      }
    },
    [benches]
  );

  useEffect(() => {
    loadBenches();
  }, []);

  useEffect(() => {
    if (benches.length === 0) return;
    if (viewMode === 'month' || viewMode === 'heatmap') {
      const ms = currentDate.startOf('month');
      const me = currentDate.endOf('month');
      loadSlots(
        ms.startOf('week').add(1, 'day'),
        me.endOf('week').add(1, 'day')
      );
    } else {
      loadSlots(weekStart, weekEnd);
    }
  }, [viewMode, currentDate, weekStart, selectedBenchIds, benches]);

  const handlePanelChange: CalendarProps<Dayjs>['onPanelChange'] = (
    value,
    mode
  ) => {
    if (mode === 'month') setCurrentDate(value);
  };

  const handleSelect: CalendarProps<Dayjs>['onSelect'] = (value) => {
    setCurrentDate(value);
  };

  const handlePrevWeek = () => setWeekStart(weekStart.subtract(7, 'day'));
  const handleNextWeek = () => setWeekStart(weekStart.add(7, 'day'));

  const handleWeekChange = (value: Dayjs | null) => {
    if (value) setWeekStart(value.startOf('week').add(1, 'day'));
  };

  const getBenchIdForDate = (dateStr: string): number | null => {
    if (selectedBenchIds.length === 1) return selectedBenchIds[0];
    const daySlots = slotsByDate[dateStr];
    if (daySlots && daySlots.length > 0) return daySlots[0].benchId;
    return null;
  };

  const getStatusSlots = (
    dateStr: string,
    status: SlotStatus
  ): SlotWithBench[] => {
    return (slotsByDate[dateStr] || []).filter((s) => s.status === status);
  };

  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD');
    const stats = dateStatsMap[dateStr];
    const statuses: SlotStatus[] = [
      'available',
      'booked',
      'occupied',
      'maintenance',
    ];

    return (
      <div className="min-h-[80px] py-1">
        <div className="flex flex-wrap gap-1 mb-2 justify-center">
          {statuses.map((status) => {
            const count = stats?.[status] || 0;
            if (count === 0) return null;
            const slots = getStatusSlots(dateStr, status);
            const benchId = getBenchIdForDate(dateStr);
            return (
              <Popover
                key={status}
                trigger="click"
                title={`${STATUS_LABELS[status]}时段 (${count})`}
                content={
                  <div
                    className="max-h-48 overflow-y-auto space-y-1"
                    style={{ minWidth: 200 }}
                  >
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-slate-50 text-xs"
                        onClick={() => {
                          const bid = benchId || slot.benchId;
                          if (bid) navigate(`/benches/${bid}?date=${dateStr}`);
                        }}
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: STATUS_COLORS[slot.status] }}
                        />
                        <span>{slot.benchName}</span>
                        <span className="text-slate-400">
                          {slot.startTime}-{slot.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                }
              >
                <div className="flex items-center gap-0.5 cursor-pointer hover:opacity-80">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  <span className="text-xs text-slate-600">{count}</span>
                </div>
              </Popover>
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
        {(() => {
          const daySlots = slotsByDate[dateStr] || [];
          if (daySlots.length === 0) return null;
          return (
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
                <span className="text-[10px] text-slate-400">
                  +{daySlots.length - 6}
                </span>
              )}
            </div>
          );
        })()}
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

  const getUtilizationColor = (rate: number) => {
    if (rate < 30) return '#52c41a';
    if (rate < 70) return '#fa8c16';
    return '#f5222d';
  };

  const renderHeatmapCell = (
    cell: HeatmapCell | undefined,
    benchId: number,
    week: { label: string; start: Dayjs; end: Dayjs }
  ) => {
    if (!cell || cell.total === 0) {
      return <div className="text-xs text-slate-300 text-center py-4">-</div>;
    }
    const bench = filteredBenches.find((b) => b.id === benchId);
    return (
      <div
        className="cursor-pointer hover:bg-slate-50 rounded p-1 transition-colors"
        onClick={() => {
          setDetailModal({
            visible: true,
            benchId,
            benchName: bench?.name || '',
            weekStart: week.start,
            weekEnd: week.end,
            weekLabel: week.label,
          });
          loadDetailSlots(benchId, week.start, week.end);
        }}
      >
        <Progress
          percent={Math.round(cell.utilizationRate)}
          size="small"
          strokeColor={getUtilizationColor(cell.utilizationRate)}
          format={(p) => `${p}%`}
        />
        <div className="text-[10px] text-slate-400 text-center">
          维护 {cell.maintenanceRate.toFixed(0)}%
        </div>
        {cell.peakTime && (
          <div className="text-center mt-0.5">
            <Tag className="!text-[10px] !py-0 !m-0" color="blue">
              {cell.peakTime}
            </Tag>
          </div>
        )}
      </div>
    );
  };

  const renderHeatmap = () => (
    <Card className="shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <Space>
          <Button
            icon={<LeftOutlined />}
            onClick={() => setCurrentDate(currentDate.subtract(1, 'month'))}
          >
            上一月
          </Button>
          <span className="text-base font-medium text-slate-700">
            {currentDate.format('YYYY年MM月')}
          </span>
          <Button
            onClick={() => setCurrentDate(currentDate.add(1, 'month'))}
          >
            下一月 <RightOutlined />
          </Button>
        </Space>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 px-3 py-2 text-left text-slate-600 font-medium min-w-[120px]">
                实验台
              </th>
              {heatmapWeeks.map((w) => (
                <th
                  key={w.label}
                  className="border border-slate-200 px-3 py-2 text-center text-slate-600 font-medium min-w-[140px]"
                >
                  <div>{w.label}</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {w.start.format('MM/DD')}-{w.end.format('MM/DD')}
                  </div>
                </th>
              ))}
              <th className="border border-slate-200 px-3 py-2 text-center text-slate-600 font-medium min-w-[120px]">
                月汇总
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredBenches.map((bench) => {
              const summary = heatmapSummary[bench.id];
              return (
                <tr key={bench.id} className="hover:bg-slate-50/50">
                  <td className="border border-slate-200 px-3 py-2">
                    <span
                      className="text-blue-600 cursor-pointer hover:underline"
                      onClick={() =>
                        navigate(
                          `/benches/${bench.id}?date=${currentDate.format('YYYY-MM-DD')}`
                        )
                      }
                    >
                      {bench.name}
                    </span>
                  </td>
                  {heatmapWeeks.map((w) => (
                    <td
                      key={w.label}
                      className="border border-slate-200 px-2 py-1"
                    >
                      {renderHeatmapCell(
                        heatmapData[bench.id]?.[w.label],
                        bench.id,
                        w
                      )}
                    </td>
                  ))}
                  <td className="border border-slate-200 px-2 py-1">
                    {summary && summary.total > 0 ? (
                      <div>
                        <Progress
                          percent={Math.round(summary.utilizationRate)}
                          size="small"
                          strokeColor={getUtilizationColor(
                            summary.utilizationRate
                          )}
                          format={(p) => `${p}%`}
                        />
                        <div className="text-[10px] text-slate-400 text-center">
                          维护 {summary.maintenanceRate.toFixed(0)}%
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 text-center">-</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

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
            <Button
              type={viewMode === 'heatmap' ? 'primary' : 'default'}
              onClick={() => setViewMode('heatmap')}
              icon={<FireOutlined />}
            >
              热力
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
        ) : viewMode === 'week' ? (
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
                        Object.entries(slotsByBench).map(
                          ([benchId, benchSlots]) =>
                            benchSlots.map((slot) => (
                              <Tooltip
                                key={slot.id}
                                title={`${slot.benchName} ${slot.startTime}-${slot.endTime} 点击查看详情`}
                              >
                                <div
                                  onClick={() =>
                                    navigate(`/benches/${benchId}`)
                                  }
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
                                    color={
                                      slot.status === 'available'
                                        ? 'green'
                                        : slot.status === 'booked'
                                        ? 'blue'
                                        : slot.status === 'occupied'
                                        ? 'orange'
                                        : 'default'
                                    }
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
        ) : (
          renderHeatmap()
        )}
      </Spin>

      <Modal
        title={`${detailModal.benchName} - ${detailModal.weekLabel} (${detailModal.weekStart.format('MM/DD')}-${detailModal.weekEnd.format('MM/DD')})`}
        open={detailModal.visible}
        onCancel={() =>
          setDetailModal((prev) => ({ ...prev, visible: false }))
        }
        footer={null}
        width={600}
      >
        <Spin spinning={detailLoading}>
          {detailSlots.length === 0 ? (
            <div className="text-center text-slate-400 py-8">暂无预约时段</div>
          ) : (
            <div className="space-y-2">
              {detailSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-3 px-3 py-2 rounded border border-slate-100 hover:bg-slate-50"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[slot.status] }}
                  />
                  <span className="text-sm text-slate-700">{slot.date}</span>
                  <span className="text-sm font-mono text-slate-500">
                    {slot.startTime}-{slot.endTime}
                  </span>
                  <Tag
                    color={slot.status === 'booked' ? 'blue' : 'orange'}
                    className="!text-xs"
                  >
                    {STATUS_LABELS[slot.status]}
                  </Tag>
                  {slot.bookingId && bookingTitles[slot.bookingId] && (
                    <span className="text-xs text-slate-400 ml-auto">
                      {bookingTitles[slot.bookingId]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
}
