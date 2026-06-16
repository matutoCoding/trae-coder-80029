import { useState, useEffect, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Tag,
  Button,
  DatePicker,
  Space,
  Typography,
  Divider,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  TimePicker,
  Radio,
  message,
  Spin,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  EditOutlined,
  SettingOutlined,
  EnvironmentOutlined,
  BarcodeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import {
  Bench,
  TimeSlot,
  SlotStatus,
  RiskLevel,
  BenchStatus,
  RISK_LABEL,
  RISK_COLOR,
  User,
  ApiResponse,
} from 'shared/types';

const { Text, Title, Paragraph } = Typography;

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const benchStatusLabelMap: Record<BenchStatus, string> = {
  active: '运行中',
  maintenance: '维护中',
  disabled: '已停用',
};

const benchStatusColorMap: Record<BenchStatus, string> = {
  active: 'green',
  maintenance: 'gold',
  disabled: 'default',
};

const slotStatusStyleMap: Record<
  SlotStatus,
  { bg: string; border: string; text: string; label: string }
> = {
  available: {
    bg: '#f6ffed',
    border: '2px solid #52c41a',
    text: '#389e0d',
    label: '空闲',
  },
  booked: {
    bg: '#e6f4ff',
    border: '2px solid #1677ff',
    text: '#0958d9',
    label: '已预约',
  },
  occupied: {
    bg: '#fff1f0',
    border: '2px solid #f5222d',
    text: '#cf1322',
    label: '使用中',
  },
  maintenance: {
    bg: '#fffbe6',
    border: '2px solid #faad14',
    text: '#d48806',
    label: '维护',
  },
};

interface BookingFormValues {
  title: string;
  tutorId: number;
  slotIds: number[];
}

interface EditSlotFormValues {
  date: Dayjs;
  startTime: Dayjs;
  endTime: Dayjs;
  status: SlotStatus;
}

export default function BenchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useUserStore();
  const isAdmin = currentUser.role === 'admin';
  const isStudent = currentUser.role === 'student';

  const [benchLoading, setBenchLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bench, setBench] = useState<Bench | null>(null);

  const [weekStart, setWeekStart] = useState<Dayjs>(dayjs().startOf('week').add(1, 'day'));
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  const [tutors, setTutors] = useState<User[]>([]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm] = Form.useForm<{
    name: string;
    code: string;
    location: string;
    riskLevel: RiskLevel;
    status: BenchStatus;
    description: string;
  }>();

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [availableSlotsForBooking, setAvailableSlotsForBooking] = useState<TimeSlot[]>([]);
  const [bookingForm] = Form.useForm<BookingFormValues>();

  const [adjustMode, setAdjustMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);
  const [editSlotModalOpen, setEditSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [editSlotSubmitting, setEditSlotSubmitting] = useState(false);
  const [editSlotForm] = Form.useForm<EditSlotFormValues>();

  const weekEnd = useMemo(() => weekStart.add(6, 'day'), [weekStart]);

  const weekDates = useMemo(() => {
    const dates: Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(weekStart.add(i, 'day'));
    }
    return dates;
  }, [weekStart]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, TimeSlot[]> = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [slots]);

  const loadBench = async () => {
    if (!id) return;
    setBenchLoading(true);
    try {
      const res = await api.get<ApiResponse<Bench>>(`/benches/${id}`);
      if (res.success && res.data) {
        setBench(res.data);
      } else {
        message.error(res.message || '加载实验台失败');
      }
    } catch (e: any) {
      message.error(e.message || '加载实验台失败');
    } finally {
      setBenchLoading(false);
    }
  };

  const loadSlots = async () => {
    if (!id) return;
    setSlotsLoading(true);
    try {
      const res = await api.get<ApiResponse<TimeSlot[]>>(`/benches/${id}/slots`, {
        params: {
          startDate: weekStart.format('YYYY-MM-DD'),
          endDate: weekEnd.format('YYYY-MM-DD'),
        },
      });
      if (res.success && res.data) {
        setSlots(res.data);
      } else {
        message.error(res.message || '加载时段失败');
      }
    } catch (e: any) {
      message.error(e.message || '加载时段失败');
    } finally {
      setSlotsLoading(false);
    }
  };

  const loadTutors = async () => {
    try {
      const res = await api.get<ApiResponse<User[]>>('/users', {
        params: { role: 'tutor' },
      });
      if (res.success && res.data) {
        setTutors(res.data);
      }
    } catch {
    }
  };

  useEffect(() => {
    loadBench();
    loadTutors();
  }, [id]);

  useEffect(() => {
    loadSlots();
  }, [id, weekStart]);

  const handlePrevWeek = () => {
    setWeekStart(weekStart.subtract(7, 'day'));
  };

  const handleNextWeek = () => {
    setWeekStart(weekStart.add(7, 'day'));
  };

  const openEditModal = () => {
    if (!bench) return;
    editForm.setFieldsValue({
      name: bench.name,
      code: bench.code,
      location: bench.location,
      riskLevel: bench.riskLevel,
      status: bench.status,
      description: bench.description,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!id) return;
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      const res = await api.put<ApiResponse<void>>(`/benches/${id}`, values);
      if (res.success) {
        message.success('更新成功');
        setEditModalOpen(false);
        loadBench();
      } else {
        message.error(res.message || '更新失败');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.message || '更新失败');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (adjustMode && isAdmin) {
      if (selectedSlotIds.includes(slot.id)) {
        setSelectedSlotIds(selectedSlotIds.filter((x) => x !== slot.id));
      } else {
        setSelectedSlotIds([...selectedSlotIds, slot.id]);
      }
      return;
    }

    if (isAdmin) {
      setEditingSlot(slot);
      editSlotForm.setFieldsValue({
        date: dayjs(slot.date),
        startTime: dayjs(slot.startTime, 'HH:mm'),
        endTime: dayjs(slot.endTime, 'HH:mm'),
        status: slot.status,
      });
      setEditSlotModalOpen(true);
      return;
    }

    if (isStudent && slot.status === 'available') {
      openBookingModal([slot]);
    }
  };

  const openBookingModal = (initialSlots: TimeSlot[]) => {
    const available = slots.filter((s) => s.status === 'available');
    setAvailableSlotsForBooking(available);
    setBookingModalOpen(true);
    bookingForm.setFieldsValue({
      slotIds: initialSlots.map((s) => s.id),
      title: '',
      tutorId: undefined,
    });
  };

  const handleOpenBookingMulti = () => {
    const available = slots.filter((s) => s.status === 'available');
    if (available.length === 0) {
      message.warning('当前周暂无空闲时段');
      return;
    }
    openBookingModal([]);
  };

  const handleBookingSubmit = async () => {
    if (!id) return;
    try {
      const values = await bookingForm.validateFields();
      setBookingSubmitting(true);
      const res = await api.post<ApiResponse<any>>('/bookings', {
        benchId: Number(id),
        applicantId: currentUser.id,
        tutorId: values.tutorId,
        title: values.title,
        slotIds: values.slotIds,
        riskLevel: bench?.riskLevel || 'low',
      });
      if (res.success) {
        message.success('预约提交成功，等待审批');
        setBookingModalOpen(false);
        bookingForm.resetFields();
        loadSlots();
      } else {
        message.error(res.message || '预约失败');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.message || '预约失败');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleBatchSetStatus = async (status: SlotStatus) => {
    if (!id) return;
    if (selectedSlotIds.length === 0) {
      message.warning('请先选择时段');
      return;
    }
    try {
      const res = await api.post<ApiResponse<void>>(`/benches/${id}/slots`, {
        ids: selectedSlotIds,
        updates: { status },
      });
      if (res.success) {
        message.success(res.message || '操作成功');
        setSelectedSlotIds([]);
        loadSlots();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleEditSlotSubmit = async () => {
    if (!id || !editingSlot) return;
    try {
      const values = await editSlotForm.validateFields();
      setEditSlotSubmitting(true);
      const res = await api.post<ApiResponse<void>>(`/benches/${id}/slots`, {
        updates: [
          {
            id: editingSlot.id,
            date: values.date.format('YYYY-MM-DD'),
            startTime: values.startTime.format('HH:mm'),
            endTime: values.endTime.format('HH:mm'),
            status: values.status,
          },
        ],
      });
      if (res.success) {
        message.success('时段更新成功');
        setEditSlotModalOpen(false);
        setEditingSlot(null);
        loadSlots();
      } else {
        message.error(res.message || '更新失败');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.message || '更新失败');
    } finally {
      setEditSlotSubmitting(false);
    }
  };

  const formatSlotOption = (slot: TimeSlot) => {
    const d = dayjs(slot.date);
    const wd = WEEKDAYS[(d.day() + 6) % 7];
    return `${d.format('MM-DD')} ${wd} ${slot.startTime}-${slot.endTime}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/benches')}
        >
          返回列表
        </Button>
      </div>

      <Spin spinning={benchLoading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            {bench && (
              <Card
                className="shadow-sm sticky top-6"
                title={
                  <div className="flex items-center justify-between pr-2">
                    <span>实验台信息</span>
                    {isAdmin && (
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={openEditModal}
                      >
                        编辑
                      </Button>
                    )}
                  </div>
                }
              >
                <div className="space-y-4">
                  <div>
                    <Title level={4} className="!mb-2">
                      {bench.name}
                    </Title>
                    <Space wrap>
                      <Tag
                        style={{
                          backgroundColor: `${RISK_COLOR[bench.riskLevel]}15`,
                          color: RISK_COLOR[bench.riskLevel],
                          borderColor: RISK_COLOR[bench.riskLevel],
                        }}
                      >
                        {RISK_LABEL[bench.riskLevel]}
                      </Tag>
                      <Tag color={benchStatusColorMap[bench.status]}>
                        {benchStatusLabelMap[bench.status]}
                      </Tag>
                    </Space>
                  </div>
                  <Divider className="!my-3" />
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <BarcodeOutlined className="text-slate-400 mt-1 w-4" />
                      <div>
                        <div className="text-slate-500 text-xs">编码</div>
                        <Text code>{bench.code}</Text>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <EnvironmentOutlined className="text-slate-400 mt-1 w-4" />
                      <div>
                        <div className="text-slate-500 text-xs">位置</div>
                        <span>{bench.location}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CalendarOutlined className="text-slate-400 mt-1 w-4" />
                      <div>
                        <div className="text-slate-500 text-xs">创建时间</div>
                        <span>{dayjs(bench.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                  {bench.description && (
                    <>
                      <Divider className="!my-3" />
                      <div>
                        <div className="text-slate-500 text-xs mb-1">描述</div>
                        <Paragraph className="!mb-0 text-sm text-slate-600 whitespace-pre-wrap">
                          {bench.description}
                        </Paragraph>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            )}
          </Col>

          <Col xs={24} lg={16}>
            <Card
              className="shadow-sm"
              title={
                <div className="flex items-center gap-2">
                  <CalendarOutlined />
                  <span>排期日历</span>
                  {adjustMode && (
                    <Tag color="blue">调整模式 · 已选 {selectedSlotIds.length} 个</Tag>
                  )}
                </div>
              }
              extra={
                <Space wrap>
                  <DatePicker
                    picker="week"
                    value={weekStart}
                    onChange={(v) => v && setWeekStart(v.startOf('week').add(1, 'day'))}
                    allowClear={false}
                  />
                  <Button icon={<LeftOutlined />} onClick={handlePrevWeek}>
                    上一周
                  </Button>
                  <Button onClick={handleNextWeek}>
                    下一周 <RightOutlined />
                  </Button>
                  {isStudent && (
                    <Button type="primary" onClick={handleOpenBookingMulti}>
                      预约时段
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      {adjustMode ? (
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={() => handleBatchSetStatus('maintenance')}
                            disabled={selectedSlotIds.length === 0}
                          >
                            设为维护
                          </Button>
                          <Button
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={() => handleBatchSetStatus('available')}
                            disabled={selectedSlotIds.length === 0}
                          >
                            设为空闲
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => {
                              setAdjustMode(false);
                              setSelectedSlotIds([]);
                            }}
                          >
                            退出
                          </Button>
                        </Space>
                      ) : (
                        <Button
                          icon={<SettingOutlined />}
                          onClick={() => {
                            setAdjustMode(true);
                            setSelectedSlotIds([]);
                          }}
                        >
                          调整时段
                        </Button>
                      )}
                    </>
                  )}
                </Space>
              }
            >
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {Object.entries(slotStatusStyleMap).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1">
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: v.bg,
                        border: v.border,
                      }}
                    />
                    <span className="text-slate-500">{v.label}</span>
                  </div>
                ))}
              </div>

              <Spin spinning={slotsLoading}>
                <div className="grid grid-cols-7 gap-2">
                  {weekDates.map((date, idx) => {
                    const dateStr = date.format('YYYY-MM-DD');
                    const isToday = date.isSame(dayjs(), 'day');
                    const daySlots = slotsByDate[dateStr] || [];
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
                        <div className="space-y-1.5 pt-2 min-h-[400px]">
                          {daySlots.length === 0 ? (
                            <div className="text-xs text-slate-300 text-center py-8">
                              无时段
                            </div>
                          ) : (
                            daySlots.map((slot) => {
                              const style = slotStatusStyleMap[slot.status];
                              const isSelected = selectedSlotIds.includes(slot.id);
                              const clickable =
                                adjustMode ||
                                isAdmin ||
                                (isStudent && slot.status === 'available');
                              return (
                                <Tooltip
                                  key={slot.id}
                                  title={
                                    adjustMode
                                      ? '点击选中'
                                      : isAdmin
                                      ? '点击编辑时段'
                                      : slot.status === 'available'
                                      ? '点击预约此时段'
                                      : undefined
                                  }
                                >
                                  <div
                                    onClick={() =>
                                      clickable && handleSlotClick(slot)
                                    }
                                    className={`rounded-md px-2 py-1.5 text-xs leading-tight transition-all ${
                                      clickable
                                        ? 'cursor-pointer hover:scale-[1.02] hover:shadow-sm'
                                        : 'cursor-default'
                                    }`}
                                    style={{
                                      background: isSelected ? '#bae0ff' : style.bg,
                                      border: isSelected
                                        ? '2px solid #1677ff'
                                        : style.border,
                                      color: isSelected ? '#0958d9' : style.text,
                                      fontWeight: isSelected ? 600 : 500,
                                    }}
                                  >
                                    <div className="font-mono">
                                      {slot.startTime} - {slot.endTime}
                                    </div>
                                    <div
                                      className="text-[10px] opacity-75 mt-0.5"
                                      style={{ color: isSelected ? '#0958d9' : style.text }}
                                    >
                                      {style.label}
                                    </div>
                                  </div>
                                </Tooltip>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Spin>
            </Card>
          </Col>
        </Row>
      </Spin>

      <Modal
        title="编辑实验台"
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalOpen(false)}
        confirmLoading={editSubmitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item
            label="实验台名称"
            name="name"
            rules={[{ required: true, message: '请输入实验台名称' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            label="实验台编码"
            name="code"
            rules={[{ required: true, message: '请输入实验台编码' }]}
          >
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item
            label="位置"
            name="location"
            rules={[{ required: true, message: '请输入位置' }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            label="危险等级"
            name="riskLevel"
            rules={[{ required: true, message: '请选择危险等级' }]}
          >
            <Radio.Group>
              <Radio value="low">
                <span style={{ color: RISK_COLOR.low }}>{RISK_LABEL.low}</span>
              </Radio>
              <Radio value="medium">
                <span style={{ color: RISK_COLOR.medium }}>
                  {RISK_LABEL.medium}
                </span>
              </Radio>
              <Radio value="high">
                <span style={{ color: RISK_COLOR.high }}>
                  {RISK_LABEL.high}
                </span>
              </Radio>
            </Radio.Group>
          </Form.Item>
          {isAdmin && (
            <Form.Item
              label="状态"
              name="status"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select
                options={[
                  { value: 'active', label: benchStatusLabelMap.active },
                  { value: 'maintenance', label: benchStatusLabelMap.maintenance },
                  { value: 'disabled', label: benchStatusLabelMap.disabled },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="预约实验台时段"
        open={bookingModalOpen}
        onOk={handleBookingSubmit}
        onCancel={() => setBookingModalOpen(false)}
        confirmLoading={bookingSubmitting}
        okText="确认预约"
        cancelText="取消"
        destroyOnClose
        width={520}
      >
        <Form form={bookingForm} layout="vertical" preserve={false}>
          <Form.Item
            label="预约标题"
            name="title"
            rules={[{ required: true, message: '请输入预约标题' }]}
          >
            <Input placeholder="请输入实验内容或用途" maxLength={100} />
          </Form.Item>
          <Form.Item
            label="选择导师"
            name="tutorId"
            rules={[{ required: true, message: '请选择导师' }]}
          >
            <Select
              placeholder="请选择指导导师"
              options={tutors.map((t) => ({
                value: t.id,
                label: `${t.name}（${t.department || ''}）`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            label="选择时段（可多选）"
            name="slotIds"
            rules={[{ required: true, message: '请至少选择一个时段' }]}
          >
            <Checkbox.Group className="w-full">
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                {availableSlotsForBooking.map((slot) => (
                  <Checkbox key={slot.id} value={slot.id} className="!mb-0">
                    <span className="font-mono text-xs">
                      {formatSlotOption(slot)}
                    </span>
                  </Checkbox>
                ))}
                {availableSlotsForBooking.length === 0 && (
                  <div className="text-slate-400 text-xs py-2 text-center">
                    暂无空闲时段
                  </div>
                )}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑时段"
        open={editSlotModalOpen}
        onOk={handleEditSlotSubmit}
        onCancel={() => {
          setEditSlotModalOpen(false);
          setEditingSlot(null);
        }}
        confirmLoading={editSlotSubmitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editSlotForm} layout="vertical" preserve={false}>
          <Form.Item
            label="日期"
            name="date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="开始时间"
                name="startTime"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="结束时间"
                name="endTime"
                rules={[{ required: true, message: '请选择结束时间' }]}
              >
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              options={[
                { value: 'available', label: slotStatusStyleMap.available.label },
                { value: 'booked', label: slotStatusStyleMap.booked.label },
                { value: 'occupied', label: slotStatusStyleMap.occupied.label },
                { value: 'maintenance', label: slotStatusStyleMap.maintenance.label },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
