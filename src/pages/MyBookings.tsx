import { useState, useEffect, useMemo } from 'react';
import { Table, Tabs, Tag, Button, Space, Popconfirm, message, App, Descriptions, Card } from 'antd';
import type { TabsProps } from 'antd';
import { EyeOutlined, StopOutlined, QrcodeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import type { Booking, BookingStatus } from 'shared/types';
import { STATUS_LABEL, RISK_LABEL, RISK_COLOR } from 'shared/types';

type TabKey = 'all' | 'pending' | 'approved' | 'rejected' | 'checked_in';

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'gold',
  tutor_approved: 'blue',
  safety_approved: 'cyan',
  admin_approved: 'purple',
  approved: 'green',
  rejected: 'red',
  checked_in: 'geekblue',
  cancelled: 'default',
};

const PENDING_STATUSES: BookingStatus[] = [
  'pending',
  'tutor_approved',
  'safety_approved',
  'admin_approved',
];

const CANCELABLE_STATUSES: BookingStatus[] = [
  'pending',
  'tutor_approved',
  'safety_approved',
  'admin_approved',
];

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

function describeProgress(booking: Booking): string {
  const nodes = booking.route?.nodes;
  if (!nodes) return '暂无审批节点';
  const sorted = [...nodes].sort((a, b) => a.orderIndex - b.orderIndex);
  const current = booking.currentNodeIndex;
  const total = sorted.length;
  if (booking.status === 'rejected') {
    const rejectNode = sorted.find((n) => n.orderIndex === current);
    return `已驳回：${rejectNode?.name || '审批节点'}驳回`;
  }
  if (booking.status === 'cancelled') return '已取消';
  if (booking.status === 'checked_in') return '已签到完成';
  if (booking.status === 'approved') return `审批通过（${total}/${total}）`;
  const approved = Math.max(0, current + 1);
  const nextNode = sorted.find((n) => n.orderIndex === current + 1);
  return `审批中：已通过 ${approved}/${total}，当前节点：${nextNode?.name || '等待中'}`;
}

export default function MyBookings() {
  const { modal, message: msgApi } = App.useApp();
  const navigate = useNavigate();
  const { currentUser } = useUserStore();
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const loadList = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Booking[] }>(
        `/bookings/mine/${currentUser.id}`
      );
      if (res.success) {
        setList(res.data || []);
      }
    } catch (err: any) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [currentUser?.id]);

  const filteredList = useMemo(() => {
    switch (activeTab) {
      case 'pending':
        return list.filter((b) => PENDING_STATUSES.includes(b.status));
      case 'approved':
        return list.filter((b) => b.status === 'approved');
      case 'rejected':
        return list.filter((b) => b.status === 'rejected');
      case 'checked_in':
        return list.filter((b) => b.status === 'checked_in');
      default:
        return list;
    }
  }, [list, activeTab]);

  const handleCancel = async (booking: Booking) => {
    try {
      const res = await api.post<{ success: boolean; message?: string }>(
        `/bookings/${booking.id}/cancel`,
        { userId: currentUser.id }
      );
      if (res.success) {
        msgApi.success(res.message || '取消成功');
        loadList();
      } else {
        msgApi.error(res.message || '取消失败');
      }
    } catch (err: any) {
      msgApi.error(err.message || '取消失败');
    }
  };

  const confirmCancel = (booking: Booking) => {
    modal.confirm({
      title: '确认取消预约？',
      content: (
        <div>
          <p>预约号：<strong>{booking.id}</strong></p>
          <p>标题：<strong>{booking.title}</strong></p>
          <p className="text-red-500">取消后时段将被释放，该操作不可撤销。</p>
        </div>
      ),
      okText: '确认取消',
      okButtonProps: { danger: true },
      cancelText: '再想想',
      onOk: () => handleCancel(booking),
    });
  };

  const columns = [
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
      width: 200,
      ellipsis: true,
    },
    {
      title: '实验台',
      key: 'bench',
      width: 160,
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
        <Tag color={RISK_COLOR[r.riskLevel]}>
          {RISK_LABEL[r.riskLevel]}
        </Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_: any, r: Booking) => (
        <Tag color={STATUS_COLORS[r.status]}>{STATUS_LABEL[r.status]}</Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '预约时段',
      key: 'slots',
      width: 260,
      render: (_: any, r: Booking) => (
        <span className="text-sm">{formatSlots(r.slots)}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
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
          {CANCELABLE_STATUSES.includes(r.status) && (
            <Popconfirm
              title="确认取消该预约？"
              description="取消后时段将被释放，该操作不可撤销。"
              okText="确认取消"
              okButtonProps={{ danger: true }}
              cancelText="再想想"
              onConfirm={() => confirmCancel(r)}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
              >
                取消预约
              </Button>
            </Popconfirm>
          )}
          {r.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              icon={<QrcodeOutlined />}
              onClick={() => navigate(`/access-checkin?bookingId=${r.id}`)}
            >
              去签到
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const tabItems: TabsProps['items'] = [
    { key: 'all', label: `全部 (${list.length})` },
    {
      key: 'pending',
      label: `审批中 (${list.filter((b) => PENDING_STATUSES.includes(b.status)).length})`,
    },
    {
      key: 'approved',
      label: `已通过 (${list.filter((b) => b.status === 'approved').length})`,
    },
    {
      key: 'rejected',
      label: `已驳回 (${list.filter((b) => b.status === 'rejected').length})`,
    },
    {
      key: 'checked_in',
      label: `已签到 (${list.filter((b) => b.status === 'checked_in').length})`,
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        className="shadow-sm"
        title="我的预约"
        styles={{ body: { padding: '16px 24px 0' } }}
      >
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
          columns={columns}
          dataSource={filteredList}
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div className="px-4 py-2 bg-slate-50 rounded-lg">
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="申请人">
                    {record.applicant?.name || '-'}
                    <span className="text-slate-400 ml-2">
                      ({record.applicant?.department || '-'})
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="导师">
                    {record.tutor?.name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="审批进度" span={2}>
                    <span
                      className={
                        record.status === 'rejected'
                          ? 'text-red-500'
                          : record.status === 'approved' || record.status === 'checked_in'
                          ? 'text-green-600'
                          : 'text-blue-600'
                      }
                    >
                      {describeProgress(record)}
                    </span>
                  </Descriptions.Item>
                  {record.bench?.description && (
                    <Descriptions.Item label="实验台说明" span={2}>
                      {record.bench.description}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
}
