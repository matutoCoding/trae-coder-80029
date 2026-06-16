import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Input,
  Space,
  Alert,
  Result,
  message,
  App,
  Descriptions,
  Divider,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import type { Booking, TimeSlot } from 'shared/types';
import { STATUS_LABEL, RISK_LABEL, RISK_COLOR } from 'shared/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  tutor_approved: 'blue',
  safety_approved: 'cyan',
  admin_approved: 'purple',
  approved: 'green',
  rejected: 'red',
  checked_in: 'geekblue',
  cancelled: 'default',
};

function formatSlots(slots?: TimeSlot[]): string {
  if (!slots || slots.length === 0) return '-';
  const sorted = [...slots].sort((a, b) => {
    const ad = `${a.date} ${a.startTime}`;
    const bd = `${b.date} ${b.startTime}`;
    return ad.localeCompare(bd);
  });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first.date === last.date) {
    return `${first.date} ${first.startTime}-${last.endTime}`;
  }
  return `${first.date} ${first.startTime} ~ ${last.date} ${last.endTime}`;
}

function getSlotTimeRange(slots?: TimeSlot[]): {
  start: dayjs.Dayjs | null;
  end: dayjs.Dayjs | null;
} {
  if (!slots || slots.length === 0) return { start: null, end: null };
  const sorted = [...slots].sort((a, b) => {
    const ad = `${a.date} ${a.startTime}`;
    const bd = `${b.date} ${b.startTime}`;
    return ad.localeCompare(bd);
  });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    start: dayjs(`${first.date} ${first.startTime}`),
    end: dayjs(`${last.date} ${last.endTime}`),
  };
}

function QRCodeMock({ text, size = 160 }: { text: string; size?: number }) {
  const gridSize = 21;
  const cellSize = size / gridSize;
  const cells = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    const arr: boolean[] = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      hash = (hash * 1103515245 + 12345) >>> 0;
      arr.push((hash & 1) === 1);
    }
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const val = isOuter || (r === 2 || r === 4 || c === 2 || c === 4) && !isInner;
        arr[r * gridSize + c] = val;
        arr[r * gridSize + (gridSize - 1 - c)] = val;
        arr[(gridSize - 1 - r) * gridSize + c] = val;
      }
    }
    return arr;
  }, [text]);

  return (
    <div
      className="relative bg-white p-3 rounded-lg shadow-inner border-2 border-slate-200"
      style={{ width: size + 24, height: size + 24 }}
    >
      <div
        className="relative"
        style={{ width: size, height: size, display: 'grid', gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: 0 }}
      >
        {cells.map((filled, idx) => (
          <div
            key={idx}
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: filled ? '#0f172a' : 'transparent',
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 bg-white rounded flex items-center justify-center shadow-sm">
          <QrcodeOutlined className="text-blue-600 text-lg" />
        </div>
      </div>
    </div>
  );
}

export default function AccessCheckin() {
  const { message: msgApi } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useUserStore();
  const [searchInput, setSearchInput] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [, setNow] = useState(dayjs());

  const urlBookingId = searchParams.get('bookingId');

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchBooking = async (id: string | number) => {
    const bookingId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(bookingId) || bookingId <= 0) {
      msgApi.warning('请输入有效的预约号');
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Booking; message?: string }>(
        `/bookings/${bookingId}`
      );
      if (res.success && res.data) {
        setBooking(res.data);
        setCheckedInAt(null);
        setSearchParams({ bookingId: String(bookingId) });
      } else {
        msgApi.error(res.message || '未找到该预约');
        setBooking(null);
      }
    } catch (err: any) {
      msgApi.error(err.message || '查询失败');
      setBooking(null);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (urlBookingId) {
      fetchBooking(urlBookingId);
    }
  }, [urlBookingId]);

  const slotRange = useMemo(() => getSlotTimeRange(booking?.slots), [booking]);

  const isInSlotTime = useMemo(() => {
    if (!slotRange.start || !slotRange.end) return false;
    const now = dayjs();
    return now.isAfter(slotRange.start.subtract(30, 'minute')) && now.isBefore(slotRange.end);
  }, [slotRange]);

  const canCheckIn = useMemo(() => {
    if (!booking) return false;
    return booking.status === 'approved' && isInSlotTime;
  }, [booking, isInSlotTime]);

  const statusWarning = useMemo(() => {
    if (!booking) return null;
    if (booking.status === 'checked_in') {
      return {
        type: 'success' as const,
        title: '已签到',
        desc: '该预约已完成签到，无需重复操作。',
      };
    }
    if (booking.status === 'cancelled') {
      return {
        type: 'error' as const,
        title: '预约已取消',
        desc: '该预约已被取消，无法签到。请重新预约。',
      };
    }
    if (booking.status === 'rejected') {
      return {
        type: 'error' as const,
        title: '预约已驳回',
        desc: '该预约未通过审批，无法签到。',
      };
    }
    if (booking.status !== 'approved') {
      return {
        type: 'warning' as const,
        title: '审批未完成',
        desc: `当前状态：${STATUS_LABEL[booking.status]}，需审批通过后方可签到。`,
      };
    }
    if (!isInSlotTime && slotRange.start && slotRange.end) {
      if (dayjs().isBefore(slotRange.start.subtract(30, 'minute'))) {
        return {
          type: 'warning' as const,
          title: '未到签到时间',
          desc: `预约时段：${formatSlots(booking.slots)}，最早可提前30分钟签到（${slotRange.start.subtract(30, 'minute').format('YYYY-MM-DD HH:mm')} 起）。`,
        };
      }
      return {
        type: 'error' as const,
        title: '已过签到时间',
        desc: `预约时段：${formatSlots(booking.slots)}，当前已超过预约结束时间，无法签到。`,
      };
    }
    return null;
  }, [booking, isInSlotTime, slotRange]);

  const handleCheckIn = async () => {
    if (!booking) return;
    if (!canCheckIn) {
      msgApi.warning('当前状态无法签到');
      return;
    }
    setCheckInLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: Booking; message?: string }>(
        `/bookings/${booking.id}/check-in`,
        { userId: currentUser.id }
      );
      if (res.success) {
        setBooking(res.data);
        setCheckedInAt(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        msgApi.success(res.message || '签到成功');
      } else {
        msgApi.error(res.message || '签到失败');
      }
    } catch (err: any) {
      msgApi.error(err.message || '签到失败');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchInput.trim()) {
      msgApi.warning('请输入预约号');
      return;
    }
    fetchBooking(searchInput.trim());
  };

  const handleClear = () => {
    setBooking(null);
    setSearchInput('');
    setCheckedInAt(null);
    setSearchParams({});
  };

  const showResult = booking?.status === 'checked_in' && checkedInAt;

  return (
    <div className="space-y-4">
      <Card
        className="shadow-sm"
        title={
          <Space>
            <SafetyCertificateOutlined className="text-blue-500" />
            <span>准入登记签到</span>
          </Space>
        }
        extra={
          booking && (
            <Button onClick={handleClear}>
              重新查询
            </Button>
          )
        }
      >
        {!booking && (
          <Space.Compact className="w-full max-w-lg" style={{ display: 'flex' }}>
            <Input
              size="large"
              placeholder="请输入预约号（如 1001）或扫码后自动填充"
              prefix={<QrcodeOutlined className="text-slate-400" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              loading={searchLoading}
              onClick={handleSearch}
            >
              查询预约
            </Button>
          </Space.Compact>
        )}
      </Card>

      {loading && (
        <Card className="shadow-sm">
          <div className="py-16 flex justify-center">
            <Spin size="large" />
          </div>
        </Card>
      )}

      {showResult && (
        <Card className="shadow-sm border-green-200">
          <Result
            status="success"
            icon={<CheckCircleOutlined className="text-green-500" />}
            title="签到成功！"
            subTitle={
              <div className="space-y-2">
                <p className="text-base">
                  签到时间：
                  <span className="font-semibold text-slate-700">{checkedInAt}</span>
                </p>
                <p className="text-sm text-slate-500">
                  预约号 #{booking?.id} · {booking?.title}
                </p>
              </div>
            }
            extra={[
              <Button key="view" onClick={() => handleClear()}>
                继续签到
              </Button>,
            ]}
          />
        </Card>
      )}

      {booking && !showResult && (
        <>
          {statusWarning && (
            <Alert
              type={statusWarning.type}
              showIcon
              icon={
                statusWarning.type === 'success' ? (
                  <CheckCircleOutlined />
                ) : statusWarning.type === 'error' ? (
                  <WarningOutlined />
                ) : (
                  <WarningOutlined />
                )
              }
              message={statusWarning.title}
              description={statusWarning.desc}
            />
          )}

          <Card className="shadow-sm">
            <Row gutter={[32, 24]} align="stretch">
              <Col xs={24} lg={15}>
                <Space align="start" size={16} className="w-full">
                  <div
                    className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0"
                  >
                    <QrcodeOutlined className="text-white text-2xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-semibold text-slate-800 m-0">
                            {booking.title}
                          </h2>
                          <Tag color={STATUS_COLORS[booking.status]}>
                            {STATUS_LABEL[booking.status]}
                          </Tag>
                          <Tag color={RISK_COLOR[booking.riskLevel]}>
                            {RISK_LABEL[booking.riskLevel]}
                          </Tag>
                        </div>
                        <p className="text-slate-500 mt-1 mb-0 text-sm">
                          预约号：<span className="font-mono text-slate-700">#{booking.id}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Space>

                <Divider className="my-6" />

                <Descriptions column={1} size="middle" className="booking-desc">
                  <Descriptions.Item
                    label={
                      <Space>
                        <EnvironmentOutlined className="text-slate-400" />
                        <span>实验台位置</span>
                      </Space>
                    }
                  >
                    <span className="font-medium">{booking.bench?.name || '-'}</span>
                    <span className="text-slate-400 ml-2">
                      （{booking.bench?.code || ''}）{booking.bench?.location || ''}
                    </span>
                  </Descriptions.Item>

                  <Descriptions.Item
                    label={
                      <Space>
                        <ClockCircleOutlined className="text-slate-400" />
                        <span>预约时段</span>
                      </Space>
                    }
                  >
                    <span className="font-medium">{formatSlots(booking.slots)}</span>
                  </Descriptions.Item>

                  <Descriptions.Item
                    label={
                      <Space>
                        <UserOutlined className="text-slate-400" />
                        <span>学生信息</span>
                      </Space>
                    }
                  >
                    <span className="font-medium">{booking.applicant?.name || '-'}</span>
                    <span className="text-slate-400 ml-2">
                      ({booking.applicant?.department || '-'})
                    </span>
                  </Descriptions.Item>

                  <Descriptions.Item
                    label={
                      <Space>
                        <TeamOutlined className="text-slate-400" />
                        <span>指导导师</span>
                      </Space>
                    }
                  >
                    <span className="font-medium">{booking.tutor?.name || '-'}</span>
                  </Descriptions.Item>
                </Descriptions>

                <Divider className="my-6" />

                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-slate-500">
                    当前时间：{dayjs().format('YYYY-MM-DD HH:mm')}
                  </div>
                  <Space>
                    <Button onClick={handleClear}>返回查询</Button>
                    <Button
                      type="primary"
                      size="large"
                      icon={<CheckCircleOutlined />}
                      loading={checkInLoading}
                      disabled={!canCheckIn}
                      onClick={handleCheckIn}
                    >
                      确认签到
                    </Button>
                  </Space>
                </div>
              </Col>

              <Col xs={24} lg={9}>
                <div className="h-full flex flex-col items-center justify-center lg:border-l lg:pl-8 py-4">
                  <QRCodeMock text={`BK-${booking.id}-${booking.createdAt}`} size={180} />
                  <p className="mt-5 text-sm text-slate-500 text-center">
                    请向管理人员出示此二维码
                  </p>
                  <p className="mt-1 text-xs text-slate-400 text-center">
                    或凭预约号 <span className="font-mono text-slate-600">#{booking.id}</span> 现场签到
                  </p>
                  {booking.bench?.description && (
                    <div className="mt-6 w-full p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                      <p className="font-medium text-slate-700 mb-1">实验台说明</p>
                      <p>{booking.bench.description}</p>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </Card>
        </>
      )}

      {!booking && !searchLoading && (
        <Card className="shadow-sm">
          <div className="text-center py-12 text-slate-400">
            <QrcodeOutlined className="text-6xl mb-4 text-slate-200" />
            <p className="text-base mb-1 text-slate-500">请输入预约号查询签到信息</p>
            <p className="text-sm">也可从「我的预约」中点击「去签到」直接进入</p>
          </div>
        </Card>
      )}
    </div>
  );
}
