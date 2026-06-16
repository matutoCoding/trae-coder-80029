import { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Tabs,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  App,
  Empty,
  Alert,
  Card,
  Row,
  Col,
  Select,
  DatePicker,
} from 'antd';
import type { TabsProps } from 'antd';
import type { Dayjs } from 'dayjs';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  UserSwitchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import type { Booking, Bench, ApprovalRoute, ApiResponse, RiskLevel } from 'shared/types';
import { STATUS_LABEL, RISK_LABEL, RISK_COLOR, ROLE_LABEL } from 'shared/types';

const { RangePicker } = DatePicker;

interface FilterFormValues {
  benchIds?: number[];
  riskLevels?: RiskLevel[];
  createdAtRange?: [Dayjs, Dayjs];
  currentNode?: string;
}

type TabKey = 'pending' | 'approved';

function getStatusColor(status: string, statusText?: string): string {
  if (statusText && statusText.includes('待')) return 'blue';
  if (status === 'approved' || status === 'checked_in') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'cancelled') return 'default';
  return 'blue';
}

const APPROVER_ROLES = ['tutor', 'admin', 'safety', 'teacher', 'approver'];

function formatSlots(slots?: Booking['slots']): string {
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

export default function ToApprove() {
  const { modal, message: msgApi } = App.useApp();
  const navigate = useNavigate();
  const { currentUser } = useUserStore();
  const [pendingList, setPendingList] = useState<Booking[]>([]);
  const [approvedList, setApprovedList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm<FilterFormValues>();
  const [benches, setBenches] = useState<Bench[]>([]);
  const [routes, setRoutes] = useState<ApprovalRoute[]>([]);
  const [filterValues, setFilterValues] = useState<FilterFormValues>({});

  const userRole = currentUser?.role || 'student';
  const isApprover = APPROVER_ROLES.includes(userRole);

  const loadPending = async () => {
    if (!currentUser?.id || !isApprover) return;
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Booking[] }>(
        `/bookings/pending/${currentUser.id}`
      );
      if (res.success) {
        setPendingList(res.data || []);
      }
    } catch (err: any) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadApproved = async () => {
    if (!currentUser?.id || !isApprover) return;
    try {
      const res = await api.get<{ success: boolean; data: Booking[] }>(
        `/bookings/approved/${currentUser.id}`
      );
      if (res.success) {
        setApprovedList(res.data || []);
      }
    } catch (err: any) {
      message.error(err.message || '加载失败');
    }
  };

  const loadBenches = async () => {
    try {
      const res = await api.get<ApiResponse<Bench[]>>('/benches');
      if (res.success && res.data) {
        setBenches(res.data);
      }
    } catch {
    }
  };

  const loadRoutes = async () => {
    try {
      const res = await api.get<ApiResponse<ApprovalRoute[]>>('/routes');
      if (res.success && res.data) {
        setRoutes(res.data);
      }
    } catch {
    }
  };

  const handleFilterChange = (_: FilterFormValues, allValues: FilterFormValues) => {
    setFilterValues(allValues);
  };

  const handleReset = () => {
    filterForm.resetFields();
    setFilterValues({});
  };

  const nodeOptions = useMemo(() => {
    const nodeSet = new Set<string>();
    routes.forEach((route) => {
      route.nodes?.forEach((node) => {
        nodeSet.add(node.role);
      });
    });
    return Array.from(nodeSet).map((role) => ({
      value: role,
      label: ROLE_LABEL[role as keyof typeof ROLE_LABEL] || role,
    }));
  }, [routes]);

  useEffect(() => {
    if (isApprover) {
      loadPending();
      loadApproved();
      loadBenches();
      loadRoutes();
    }
  }, [currentUser?.id, isApprover]);

  const filterBookings = (bookings: Booking[]): Booking[] => {
    return bookings.filter((booking) => {
      if (filterValues.benchIds && filterValues.benchIds.length > 0) {
        if (!filterValues.benchIds.includes(booking.benchId)) {
          return false;
        }
      }

      if (filterValues.riskLevels && filterValues.riskLevels.length > 0) {
        if (!filterValues.riskLevels.includes(booking.riskLevel)) {
          return false;
        }
      }

      if (filterValues.createdAtRange && filterValues.createdAtRange.length === 2) {
        const [start, end] = filterValues.createdAtRange;
        const createdAt = dayjs(booking.createdAt);
        if (createdAt.isBefore(start.startOf('day')) || createdAt.isAfter(end.endOf('day'))) {
          return false;
        }
      }

      if (filterValues.currentNode) {
        const statusText = (booking as any).statusText || '';
        const roleLabel = ROLE_LABEL[filterValues.currentNode as keyof typeof ROLE_LABEL] || filterValues.currentNode;
        if (!statusText.includes(`待${roleLabel}`)) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredPending = useMemo(() => filterBookings(pendingList), [pendingList, filterValues]);
  const filteredApproved = useMemo(() => filterBookings(approvedList), [approvedList, filterValues]);

  const currentData = useMemo(() => {
    return activeTab === 'pending' ? filteredPending : filteredApproved;
  }, [activeTab, filteredPending, filteredApproved]);

  const openApproveModal = (booking: Booking) => {
    setCurrentBooking(booking);
    form.resetFields();
    setApproveModalOpen(true);
  };

  const openRejectModal = (booking: Booking) => {
    setCurrentBooking(booking);
    form.resetFields();
    setRejectModalOpen(true);
  };

  const handleApprove = async () => {
    if (!currentBooking) return;
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);
      const res = await api.post<{ success: boolean; message?: string }>(
        '/bookings/approve',
        {
          bookingId: currentBooking.id,
          approverId: currentUser.id,
          comment: values.comment || '',
        }
      );
      if (res.success) {
        msgApi.success(res.message || '审批通过');
        setApproveModalOpen(false);
        setCurrentBooking(null);
        loadPending();
        loadApproved();
      } else {
        msgApi.error(res.message || '审批失败');
      }
    } catch (err: any) {
      msgApi.error(err.message || '审批失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReject = async () => {
    if (!currentBooking) return;
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);
      const res = await api.post<{ success: boolean; message?: string }>(
        '/bookings/reject',
        {
          bookingId: currentBooking.id,
          approverId: currentUser.id,
          comment: values.comment || '驳回',
        }
      );
      if (res.success) {
        msgApi.success(res.message || '已驳回');
        setRejectModalOpen(false);
        setCurrentBooking(null);
        loadPending();
        loadApproved();
      } else {
        msgApi.error(res.message || '驳回失败');
      }
    } catch (err: any) {
      msgApi.error(err.message || '驳回失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const findMyRecord = (booking: Booking) => {
    const records = booking.records || [];
    return records
      .slice()
      .reverse()
      .find((r) => r.approverId === currentUser?.id);
  };

  const pendingColumns = [
    {
      title: '预约号',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      fixed: 'left' as const,
      render: (v: number) => <span className="font-mono">#{v}</span>,
    },
    {
      title: '预约标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '申请人',
      key: 'applicant',
      width: 130,
      render: (_: any, r: Booking) => (
        <Space direction="vertical" size={0}>
          <span className="font-medium">{r.applicant?.name || '-'}</span>
          <span className="text-xs text-slate-400">
            {r.applicant?.department || ''}
          </span>
        </Space>
      ),
    },
    {
      title: '实验台',
      key: 'bench',
      width: 150,
      render: (_: any, r: Booking) => (
        <Space direction="vertical" size={0}>
          <span className="font-medium">{r.bench?.name || '-'}</span>
          <span className="text-xs text-slate-400">{r.bench?.location || ''}</span>
        </Space>
      ),
    },
    {
      title: '危险等级',
      key: 'riskLevel',
      width: 90,
      render: (_: any, r: Booking) => (
        <Tag color={RISK_COLOR[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</Tag>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '预约时段',
      key: 'slots',
      width: 250,
      render: (_: any, r: Booking) => (
        <span className="text-sm">{formatSlots(r.slots)}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, r: Booking) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/approval-chains/${r.id}`)}
          >
            审批链
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => openApproveModal(r)}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => openRejectModal(r)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  const approvedColumns = [
    {
      title: '预约号',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      fixed: 'left' as const,
      render: (v: number) => <span className="font-mono">#{v}</span>,
    },
    {
      title: '预约标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '申请人',
      key: 'applicant',
      width: 130,
      render: (_: any, r: Booking) => r.applicant?.name || '-',
    },
    {
      title: '实验台',
      key: 'bench',
      width: 140,
      render: (_: any, r: Booking) => r.bench?.name || '-',
    },
    {
      title: '我的审批',
      key: 'myAction',
      width: 100,
      render: (_: any, r: Booking) => {
        const rec = findMyRecord(r);
        if (!rec) return <Tag>无记录</Tag>;
        return rec.action === 'approve' ? (
          <Tag color="green">已通过</Tag>
        ) : (
          <Tag color="red">已驳回</Tag>
        );
      },
    },
    {
      title: '审批意见',
      key: 'myComment',
      width: 200,
      ellipsis: true,
      render: (_: any, r: Booking) => {
        const rec = findMyRecord(r);
        return rec?.comment || <span className="text-slate-400">无</span>;
      },
    },
    {
      title: '审批时间',
      key: 'approvedAt',
      width: 170,
      render: (_: any, r: Booking) => {
        const rec = findMyRecord(r);
        return rec ? dayjs(rec.createdAt).format('YYYY-MM-DD HH:mm') : '-';
      },
    },
    {
      title: '当前状态',
      key: 'status',
      width: 110,
      render: (_: any, r: Booking) => {
        const text = (r as any).statusText || STATUS_LABEL[r.status];
        const color = getStatusColor(r.status, (r as any).statusText);
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, r: Booking) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/approval-chains/${r.id}`)}
        >
          审批链
        </Button>
      ),
    },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'pending',
      label: `待我审批 (${filteredPending.length}/${pendingList.length})`,
    },
    {
      key: 'approved',
      label: `我已审批 (${filteredApproved.length}/${approvedList.length})`,
    },
  ];

  if (!isApprover) {
    return (
      <div className="space-y-4">
        <Alert
          type="warning"
          showIcon
          message="当前角色无审批权限"
          description={
            <div>
            <p>
              您当前的角色是：
              <Tag color="blue" className="ml-1">
                {ROLE_LABEL[(userRole as any)] || '学生'}
              </Tag>
              ，仅
              <Tag color="green" className="mx-1">导师</Tag>
              <Tag color="purple" className="mx-1">安全员</Tag>
              <Tag color="geekblue">管理员</Tag>
              角色拥有审批权限。
            </p>
            <p className="mt-2">
              请使用右上角用户切换功能，切换到拥有审批权限的账号后查看。
            </p>
            </div>
          }
          icon={<UserSwitchOutlined />}
        />
        <Card className="shadow-sm">
          <Empty
            description={
              <div className="text-center">
                <p className="text-slate-500 text-lg mb-2">暂无审批内容</p>
                <p className="text-slate-400 text-sm">切换审批角色后可查看待审批列表</p>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="py-16"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        className="shadow-sm"
        title="审批中心"
        styles={{ body: { padding: '16px 24px 0' } }}
      >
        <Form
          form={filterForm}
          layout="vertical"
          onValuesChange={handleFilterChange}
          initialValues={{}}
          className="mb-4"
        >
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="实验台" name="benchIds">
                <Select
                  mode="multiple"
                  placeholder="请选择实验台"
                  allowClear
                  options={benches.map((b) => ({
                    value: b.id,
                    label: `${b.name}（${b.location}）`,
                  }))}
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="危险等级" name="riskLevels">
                <Select
                  mode="multiple"
                  placeholder="请选择危险等级"
                  allowClear
                  options={(['low', 'medium', 'high'] as RiskLevel[]).map((r) => ({
                    value: r,
                    label: (
                      <span style={{ color: RISK_COLOR[r] }}>
                        {RISK_LABEL[r]}
                      </span>
                    ),
                  }))}
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="提交时间" name="createdAtRange">
                <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="当前审批节点" name="currentNode">
                <Select
                  placeholder="请选择审批节点"
                  allowClear
                  options={nodeOptions}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row justify="end">
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
          items={tabItems}
        />
      </Card>

      <Card className="shadow-sm" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={activeTab === 'pending' ? pendingColumns : approvedColumns}
          dataSource={currentData}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  activeTab === 'pending' ? '暂无待审批记录' : '暂无已审批记录'
                }
                className="py-12"
              />
            ),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <CheckOutlined className="text-green-500" />
            <span>通过审批</span>
          </Space>
        }
        open={approveModalOpen}
        onCancel={() => {
          setApproveModalOpen(false);
          setCurrentBooking(null);
        }}
        onOk={handleApprove}
        confirmLoading={submitLoading}
        okText="确认通过"
        okButtonProps={{ type: 'primary' }}
        cancelText="取消"
        width={520}
      >
        {currentBooking && (
          <div className="mb-4 p-4 bg-slate-50 rounded-lg space-y-2">
            <p>
              <span className="text-slate-500">预约号：</span>
              <span className="font-mono font-medium">#{currentBooking.id}</span>
            </p>
            <p>
              <span className="text-slate-500">标题：</span>
              <span className="font-medium">{currentBooking.title}</span>
            </p>
            <p>
              <span className="text-slate-500">申请人：</span>
              <span>{currentBooking.applicant?.name || '-'}</span>
            </p>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            label="审批意见（选填）"
            name="comment"
            rules={[{ max: 200, message: '最多200字' }]}
          >
            <Input.TextArea
              placeholder="请输入审批意见..."
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <CloseOutlined className="text-red-500" />
            <span>驳回审批</span>
          </Space>
        }
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          setCurrentBooking(null);
        }}
        onOk={handleReject}
        confirmLoading={submitLoading}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        width={520}
      >
        {currentBooking && (
          <div className="mb-4 p-4 bg-slate-50 rounded-lg space-y-2">
            <p>
              <span className="text-slate-500">预约号：</span>
              <span className="font-mono font-medium">#{currentBooking.id}</span>
            </p>
            <p>
              <span className="text-slate-500">标题：</span>
              <span className="font-medium">{currentBooking.title}</span>
            </p>
            <p>
              <span className="text-slate-500">申请人：</span>
              <span>{currentBooking.applicant?.name || '-'}</span>
            </p>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            label="驳回原因"
            name="comment"
            rules={[
              { required: true, message: '请输入驳回原因' },
              { max: 200, message: '最多200字' },
            ]}
          >
            <Input.TextArea
              placeholder="请详细说明驳回原因..."
              rows={4}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
