import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  Typography,
  Tag,
  Timeline,
  Empty,
  Progress,
  Space,
  Tooltip,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  StopOutlined,
  UserOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import dayjs from 'dayjs';
import {
  Booking,
  STATUS_LABEL,
  ApiResponse,
} from '../../shared/types';

const { Text, Title } = Typography;

interface DashboardStats {
  todayBookings: number;
  weekBookings: number;
  pendingApproval: number;
  byStatus: Record<string, number>;
  benchUsage: {
    benchId: number;
    benchName: string;
    totalSlots: number;
    usedSlots: number;
    rate: number;
  }[];
}

const bookingStatusColor: Record<string, string> = {
  pending: 'gold',
  tutor_approved: 'cyan',
  safety_approved: 'geekblue',
  admin_approved: 'purple',
  approved: 'green',
  rejected: 'red',
  checked_in: 'success',
  cancelled: 'default',
};

export default function Dashboard() {
  const { currentUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weekBookingsList, setWeekBookingsList] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<DashboardStats>>('/dashboard');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadWeekBookings = async () => {
    setBookingsLoading(true);
    try {
      const res = await api.get<ApiResponse<Booking[]>>('/bookings');
      if (res.success && res.data) {
        const weekStart = dayjs().startOf('week').add(1, 'day');
        const weekEnd = weekStart.add(7, 'day');
        const filtered = res.data.filter((b) => {
          const slots = b.slots || [];
          return slots.some((s) => {
            const d = dayjs(s.date);
            return d.isAfter(weekStart.subtract(1, 'day')) && d.isBefore(weekEnd);
          });
        });
        filtered.sort((a, b) => {
          const sa = a.slots?.[0];
          const sb = b.slots?.[0];
          if (!sa) return 1;
          if (!sb) return -1;
          const ka = `${sa.date} ${sa.startTime}`;
          const kb = `${sb.date} ${sb.startTime}`;
          return ka.localeCompare(kb);
        });
        setWeekBookingsList(filtered);
      }
    } catch {
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadWeekBookings();
  }, []);

  const benchCount = stats?.benchUsage.length ?? 0;
  const totalSlots = stats?.benchUsage.reduce((s, b) => s + b.totalSlots, 0) ?? 0;
  const usedSlots = stats?.benchUsage.reduce((s, b) => s + b.usedSlots, 0) ?? 0;
  const weekUsageRate =
    totalSlots > 0 ? Number(((usedSlots / totalSlots) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-6">
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card
              className="h-full shadow-sm hover:shadow-md transition-shadow"
              styles={{ body: { padding: 20 } }}
            >
              <Statistic
                title="今日预约"
                value={stats?.todayBookings ?? 0}
                suffix="个"
                prefix={
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                    <CalendarOutlined className="text-xl" />
                  </div>
                }
                valueStyle={{ color: '#1677ff', marginLeft: 12 }}
                className="[&_.ant-statistic-title]:!mb-3 [&_.ant-statistic-title]:!text-slate-500 [&_.ant-statistic-title]:!text-sm [&_.ant-statistic-content]:!items-center [&_.ant-statistic-content]:!flex"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              className="h-full shadow-sm hover:shadow-md transition-shadow"
              styles={{ body: { padding: 20 } }}
            >
              <Statistic
                title="待审批"
                value={stats?.pendingApproval ?? 0}
                suffix="项"
                prefix={
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                    <ClockCircleOutlined className="text-xl" />
                  </div>
                }
                valueStyle={{ color: '#faad14', marginLeft: 12 }}
                className="[&_.ant-statistic-title]:!mb-3 [&_.ant-statistic-title]:!text-slate-500 [&_.ant-statistic-title]:!text-sm [&_.ant-statistic-content]:!items-center [&_.ant-statistic-content]:!flex"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              className="h-full shadow-sm hover:shadow-md transition-shadow"
              styles={{ body: { padding: 20 } }}
            >
              <Statistic
                title="实验台数量"
                value={benchCount}
                suffix="台"
                prefix={
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <ExperimentOutlined className="text-xl" />
                  </div>
                }
                valueStyle={{ color: '#52c41a', marginLeft: 12 }}
                className="[&_.ant-statistic-title]:!mb-3 [&_.ant-statistic-title]:!text-slate-500 [&_.ant-statistic-title]:!text-sm [&_.ant-statistic-content]:!items-center [&_.ant-statistic-content]:!flex"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              className="h-full shadow-sm hover:shadow-md transition-shadow"
              styles={{ body: { padding: 20 } }}
            >
              <Statistic
                title="本周使用率"
                value={weekUsageRate}
                suffix="%"
                prefix={
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500">
                    <BarChartOutlined className="text-xl" />
                  </div>
                }
                valueStyle={{ color: '#722ed1', marginLeft: 12 }}
                className="[&_.ant-statistic-title]:!mb-3 [&_.ant-statistic-title]:!text-slate-500 [&_.ant-statistic-title]:!text-sm [&_.ant-statistic-content]:!items-center [&_.ant-statistic-content]:!flex"
              />
            </Card>
          </Col>
        </Row>
      </Spin>

      {stats && stats.benchUsage.length > 0 && (
        <Card className="shadow-sm" title="本周各实验台使用率">
          <Row gutter={[16, 16]}>
            {stats.benchUsage.map((b) => (
              <Col xs={24} sm={12} lg={6} key={b.benchId}>
                <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <Text strong className="text-sm truncate">
                      {b.benchName}
                    </Text>
                    <Tag color="blue" className="!text-xs">
                      {b.usedSlots}/{b.totalSlots}
                    </Tag>
                  </div>
                  <Progress
                    percent={Number((b.rate * 100).toFixed(1))}
                    size="small"
                    strokeColor={
                      b.rate >= 0.8
                        ? '#f5222d'
                        : b.rate >= 0.5
                        ? '#fa8c16'
                        : '#52c41a'
                    }
                  />
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card
        className="shadow-sm"
        title={
          <div className="flex items-center gap-2">
            <CalendarOutlined />
            <span>本周预约时间线</span>
            <Text type="secondary" className="text-xs font-normal">
              {dayjs().startOf('week').add(1, 'day').format('MM/DD')} ~{' '}
              {dayjs().startOf('week').add(7, 'day').format('MM/DD')}
            </Text>
          </div>
        }
        loading={bookingsLoading}
      >
        {weekBookingsList.length === 0 ? (
          <Empty
            description="本周暂无预约"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="py-8"
          />
        ) : (
          <Timeline
            mode="left"
            items={weekBookingsList.map((booking) => {
              const firstSlot = booking.slots?.[0];
              const lastSlot = booking.slots?.[booking.slots.length - 1];
              const dateStr = firstSlot
                ? dayjs(firstSlot.date).format('MM-DD ddd')
                : '';
              const timeStr =
                firstSlot && lastSlot
                  ? `${firstSlot.startTime} ~ ${lastSlot.endTime}`
                  : '';
              const isCurrentUser = booking.applicantId === currentUser.id;
              const isCheckedIn = booking.status === 'checked_in';
              const isRejected = booking.status === 'rejected';
              const isCancelled = booking.status === 'cancelled';
              return {
                color: isCheckedIn
                  ? 'green'
                  : isRejected || isCancelled
                  ? 'red'
                  : 'blue',
                dot: isCheckedIn ? (
                  <CheckCircleOutlined className="!text-green-500" />
                ) : isRejected || isCancelled ? (
                  <StopOutlined className="!text-red-500" />
                ) : (
                  <ClockCircleOutlined />
                ),
                label: (
                  <div className="text-xs">
                    <div className="font-medium text-slate-700">{dateStr}</div>
                    <div className="text-slate-500 font-mono">{timeStr}</div>
                  </div>
                ),
                children: (
                  <Card
                    size="small"
                    className={`${
                      isCurrentUser ? '!border-blue-200 !bg-blue-50/40' : ''
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Title level={5} className="!mb-0 !text-sm truncate flex-1">
                          {booking.title}
                        </Title>
                        <Tag
                          color={bookingStatusColor[booking.status] || 'default'}
                          className="!text-xs !mb-0 flex-shrink-0"
                        >
                          {STATUS_LABEL[booking.status] || booking.status}
                        </Tag>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {booking.bench && (
                          <div className="flex items-center gap-1">
                            <EnvironmentOutlined className="scale-90" />
                            <span>{booking.bench.name}</span>
                            <Tag
                              color="default"
                              className="!text-[10px] !py-0 !px-1.5 !ml-1"
                            >
                              {booking.bench.code}
                            </Tag>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Tooltip title="申请人">
                            <div className="flex items-center gap-1">
                              <UserOutlined className="scale-90" />
                              <span>
                                {booking.applicant?.name || '申请人未知'}
                              </span>
                            </div>
                          </Tooltip>
                          <span className="text-slate-300">|</span>
                          <Tooltip title="指导导师">
                            <span>导师: {booking.tutor?.name || '未指定'}</span>
                          </Tooltip>
                        </div>
                        <div className="text-slate-400 pt-0.5">
                          提交: {dayjs(booking.createdAt).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    </div>
                  </Card>
                ),
              };
            })}
          />
        )}
      </Card>
    </div>
  );
}
