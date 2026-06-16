import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Tag,
  Timeline,
  Empty,
  App,
  Typography,
  Spin,
  Space,
  Avatar,
  Divider,
  Tooltip,
  Statistic,
  Row,
  Col,
} from 'antd';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  SafetyOutlined,
  UserAddOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import type {
  ApprovalChain,
  ChainNodeState,
  Booking,
  ApiResponse,
  ApprovalRecord,
  RiskLevel,
  UserRole,
} from 'shared/types';
import {
  ROLE_LABEL,
  RISK_LABEL,
  RISK_COLOR,
  STATUS_LABEL,
} from 'shared/types';

const { Title, Text } = Typography;

function getRiskColor(level: RiskLevel): string {
  return RISK_COLOR[level] || '#64748b';
}

function getBookingStatusColor(status: Booking['status']): string {
  switch (status) {
    case 'approved':
    case 'checked_in':
      return '#52c41a';
    case 'rejected':
    case 'cancelled':
      return '#ff4d4f';
    case 'pending':
      return '#fa8c16';
    default:
      return '#1677ff';
  }
}

function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '#1677ff';
    case 'tutor':
      return '#722ed1';
    case 'safety':
      return '#fa8c16';
    case 'student':
      return '#52c41a';
    default:
      return '#64748b';
  }
}

function formatDuration(ms: number): string {
  if (ms < 0) return '0分钟';
  const duration = dayjs.duration(ms);
  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}分钟`);

  return parts.join('');
}

interface NodeVisualProps {
  state: ChainNodeState;
  index: number;
  isLast: boolean;
  prevRecord?: ApprovalRecord;
  bookingCreatedAt: string;
}

function ChainNode({ state, index, isLast, prevRecord, bookingCreatedAt }: NodeVisualProps) {
  const isApproved = state.status === 'approved';
  const isRejected = state.status === 'rejected';
  const isCurrent = state.status === 'current';
  const isPending = state.status === 'pending';

  let borderColor = '#cbd5e1';
  let bgColor = '#f8fafc';
  let textColor = '#64748b';
  let iconNode: React.ReactNode = <span className="font-bold">{index + 1}</span>;
  let shadowClass = '';
  let pulseClass = '';

  if (isApproved) {
    borderColor = '#52c41a';
    bgColor = '#f6ffed';
    textColor = '#52c41a';
    iconNode = <CheckCircleFilled style={{ color: '#52c41a', fontSize: 24 }} />;
  } else if (isRejected) {
    borderColor = '#ff4d4f';
    bgColor = '#fff1f0';
    textColor = '#ff4d4f';
    iconNode = <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 24 }} />;
  } else if (isCurrent) {
    borderColor = '#1677ff';
    bgColor = '#e6f4ff';
    textColor = '#1677ff';
    shadowClass = 'shadow-lg shadow-blue-300/50';
    pulseClass = 'chain-pulse';
  } else if (isPending) {
    iconNode = <ClockCircleOutlined style={{ fontSize: 22 }} />;
  }

  const lineColor = isApproved
    ? '#52c41a'
    : isRejected
    ? '#ff4d4f'
    : '#cbd5e1';

  const statusLabel = {
    approved: '已通过',
    current: '待审批',
    pending: '待审批',
    rejected: '已驳回',
    skipped: '已跳过',
  }[state.status];

  const getExtraInfo = () => {
    if ((isApproved || isRejected) && state.record) {
      const currentTime = dayjs(state.record.createdAt);
      const prevTime = prevRecord
        ? dayjs(prevRecord.createdAt)
        : dayjs(bookingCreatedAt);
      const duration = currentTime.diff(prevTime);

      return (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-slate-500 font-mono">
            {state.record.createdAt}
          </div>
          <Tag color="default" className="!m-0 !text-xs">
            耗时：{formatDuration(duration)}
          </Tag>
        </div>
      );
    }

    if (isCurrent) {
      const currentTime = dayjs();
      const prevTime = prevRecord
        ? dayjs(prevRecord.createdAt)
        : dayjs(bookingCreatedAt);
      const waitDuration = currentTime.diff(prevTime);

      return (
        <div className="mt-2">
          <Tag color="blue" className="!m-0 !text-xs">
            已等待 {formatDuration(waitDuration)}
          </Tag>
        </div>
      );
    }

    if (isPending) {
      return (
        <div className="mt-2">
          <Text type="secondary" className="text-xs">
            预计处理人：{ROLE_LABEL[state.node.role]}
          </Text>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex items-start shrink-0">
      <div className="flex flex-col items-center">
        <Tooltip title={statusLabel}>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center ${shadowClass} ${pulseClass} transition-all`}
            style={{
              border: `3px solid ${borderColor}`,
              backgroundColor: bgColor,
            }}
          >
            <div style={{ color: textColor }}>{iconNode}</div>
          </div>
        </Tooltip>
        <div className="mt-3 w-28 text-center">
          <div className="font-medium text-slate-800 text-sm truncate">
            {state.node.name}
          </div>
          <Tag
            color={getRoleColor(state.node.role)}
            className="!mt-1 !mb-0 !text-xs"
          >
            {ROLE_LABEL[state.node.role]}
          </Tag>
          <div>
            <Tag
              className="!mt-1 !mb-0 !text-xs"
              color={
                isApproved
                  ? 'green'
                  : isRejected
                  ? 'red'
                  : isCurrent
                  ? 'blue'
                  : 'default'
              }
            >
              {statusLabel}
            </Tag>
          </div>
          {getExtraInfo()}
        </div>
      </div>
      {!isLast && (
        <div className="flex items-center pt-9 px-2 shrink-0">
          <div
            className="h-1 w-16 rounded-full"
            style={{ backgroundColor: lineColor }}
          />
          <ArrowRightOutlined
            className="ml-1"
            style={{ color: lineColor }}
          />
        </div>
      )}
    </div>
  );
}

export default function ApprovalChain() {
  const { message } = App.useApp();
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [chain, setChain] = useState<ApprovalChain | null>(null);

  const fetchData = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const id = Number(bookingId);
      const res = await api.get<ApiResponse<ApprovalChain>>(
        `/bookings/${id}/chain`
      );
      if (res.success && res.data) {
        setChain(res.data);
      } else {
        message.error(res.message || '获取审批链失败');
      }
    } catch (e: any) {
      message.error(e.message || '获取审批链失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [bookingId]);

  const booking = chain?.booking;

  const goBack = () => {
    navigate(-1);
  };

  const goMyBookings = () => {
    navigate('/my-bookings');
  };

  const goToApprove = () => {
    navigate('/to-approve');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={goBack}
          className="!border-slate-200"
        >
          返回
        </Button>
        <div className="flex-1">
          <Title level={4} className="!m-0 !text-slate-800">
            审批链路详情
          </Title>
        </div>
        <Space>
          <Button onClick={goMyBookings} icon={<FileTextOutlined />}>
            我的预约
          </Button>
          <Button type="primary" onClick={goToApprove} icon={<SafetyOutlined />}>
            待我审批
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {!booking && !loading ? (
          <Empty
            description="未找到预约信息"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="py-20"
          />
        ) : (
          booking && (
            <>
              <Card
                className="shadow-sm"
                styles={{ body: { padding: 20 } }}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                        <FileTextOutlined className="text-xl" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Title level={4} className="!m-0 !text-slate-800">
                          {booking.title}
                        </Title>
                        <Space className="mt-2" size="middle" wrap>
                          <Tag
                            className="!m-0"
                            icon={<ExperimentOutlined />}
                            color="blue"
                          >
                            {booking.bench?.name ||
                              `实验台 #${booking.benchId}`}
                          </Tag>
                          <Tag
                            className="!m-0"
                            icon={<UserAddOutlined />}
                            color="purple"
                          >
                            申请人：{booking.applicant?.name || '未知'}
                          </Tag>
                          <Tag
                            className="!m-0"
                            style={{
                              backgroundColor: `${getRiskColor(
                                booking.riskLevel
                              )}15`,
                              borderColor: getRiskColor(booking.riskLevel),
                              color: getRiskColor(booking.riskLevel),
                            }}
                          >
                            危险等级：{RISK_LABEL[booking.riskLevel]}
                          </Tag>
                          <Tag
                            className="!m-0"
                            style={{
                              backgroundColor: `${getBookingStatusColor(
                                booking.status
                              )}15`,
                              borderColor: getBookingStatusColor(booking.status),
                              color: getBookingStatusColor(booking.status),
                            }}
                          >
                            状态：{STATUS_LABEL[booking.status]}
                          </Tag>
                        </Space>
                      </div>
                    </div>
                  </div>
                </div>

                <Divider className="!my-5" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Text type="secondary" className="text-xs">
                      预约ID
                    </Text>
                    <div className="font-mono text-slate-700 mt-1">
                      #{booking.id}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" className="text-xs">
                      创建时间
                    </Text>
                    <div className="font-mono text-slate-700 mt-1">
                      {booking.createdAt}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" className="text-xs">
                      关联路由
                    </Text>
                    <div className="text-slate-700 mt-1">
                      {booking.route?.name || `#${booking.routeId}`}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" className="text-xs">
                      导师
                    </Text>
                    <div className="text-slate-700 mt-1">
                      {booking.tutor?.name || '未指定'}
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                title={
                  <div className="flex items-center gap-2">
                    <SafetyOutlined className="text-blue-500" />
                    <span>审批流程</span>
                  </div>
                }
                className="shadow-sm overflow-hidden"
              >
                <style>{`
                  @keyframes chainPulse {
                    0%, 100% {
                      box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.4), 0 10px 25px -5px rgba(22, 119, 255, 0.2);
                    }
                    50% {
                      box-shadow: 0 0 0 12px rgba(22, 119, 255, 0), 0 10px 25px -5px rgba(22, 119, 255, 0.3);
                    }
                  }
                  .chain-pulse {
                    animation: chainPulse 2s ease-in-out infinite;
                  }
                `}</style>
                {chain?.nodes && chain.nodes.length > 0 && (
                  <div className="mb-4">
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic
                          title="审批进度"
                          value={`${chain.nodes.filter(n => n.status === 'approved').length}/${chain.nodes.length}`}
                          prefix={<CheckCircleFilled style={{ color: '#52c41a' }} />}
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="总耗时"
                          value={formatDuration(
                            booking.records && booking.records.length > 0
                              ? dayjs(
                                  booking.records
                                    .slice()
                                    .sort((a, b) =>
                                      new Date(b.createdAt).getTime() -
                                      new Date(a.createdAt).getTime()
                                    )[0].createdAt
                                ).diff(dayjs(booking.createdAt))
                              : dayjs().diff(dayjs(booking.createdAt))
                          )}
                          prefix={<ClockCircleOutlined style={{ color: '#1677ff' }} />}
                        />
                      </Col>
                      <Col span={8}>
                        {chain.nodes.some(n => n.status === 'current') && (
                          <Statistic
                            title="当前节点已等待"
                            value={formatDuration(
                              dayjs().diff(
                                booking.records && booking.records.length > 0
                                  ? dayjs(
                                      booking.records
                                        .slice()
                                        .sort((a, b) =>
                                          new Date(b.createdAt).getTime() -
                                          new Date(a.createdAt).getTime()
                                        )[0].createdAt
                                    )
                                  : dayjs(booking.createdAt)
                              )
                            )}
                            prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                            valueStyle={{ color: '#fa8c16' }}
                          />
                        )}
                      </Col>
                    </Row>
                    <Divider className="!my-4" />
                  </div>
                )}
                {!chain?.nodes || chain.nodes.length === 0 ? (
                  <Empty
                    description="暂无审批节点"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    className="py-12"
                  />
                ) : (
                  <div className="overflow-x-auto pb-4 -mx-4 px-4">
                    <div className="flex items-start min-w-max py-4">
                      {chain.nodes.map((state, idx) => {
                        const prevApprovedRecords = chain.nodes
                          .slice(0, idx)
                          .filter(n => n.record)
                          .map(n => n.record!);
                        const prevRecord =
                          prevApprovedRecords.length > 0
                            ? prevApprovedRecords[prevApprovedRecords.length - 1]
                            : undefined;

                        return (
                          <ChainNode
                            key={state.node.id || idx}
                            state={state}
                            index={idx}
                            isLast={idx === chain.nodes.length - 1}
                            prevRecord={prevRecord}
                            bookingCreatedAt={booking.createdAt}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>

              <Card
                title={
                  <div className="flex items-center gap-2">
                    <ClockCircleOutlined className="text-blue-500" />
                    <span>审批历史</span>
                  </div>
                }
                className="shadow-sm"
              >
                {!booking.records || booking.records.length === 0 ? (
                  <Empty
                    description="暂无审批记录"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    className="py-12"
                  />
                ) : (
                  <Timeline
                    className="!m-0"
                    items={(() => {
                      const sortedRecords = booking.records
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(a.createdAt).getTime() -
                            new Date(b.createdAt).getTime()
                        );
                      return sortedRecords.map((record, idx) => {
                        const isApprove = record.action === 'approve';
                        const prevRecord = idx === 0 ? null : sortedRecords[idx - 1];
                        const duration = prevRecord
                          ? dayjs(record.createdAt).diff(dayjs(prevRecord.createdAt))
                          : dayjs(record.createdAt).diff(dayjs(booking.createdAt));

                        return {
                          dot: isApprove ? (
                            <CheckCircleFilled
                              style={{
                                color: '#52c41a',
                                fontSize: 16,
                              }}
                            />
                          ) : (
                            <CloseCircleFilled
                              style={{
                                color: '#ff4d4f',
                                fontSize: 16,
                              }}
                            />
                          ),
                          color: isApprove ? 'green' : 'red',
                          children: (
                            <div className="pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Avatar
                                  size={28}
                                  icon={<UserOutlined />}
                                  style={{
                                    backgroundColor: isApprove
                                      ? '#52c41a'
                                      : '#ff4d4f',
                                  }}
                                />
                                <span className="font-medium text-slate-800">
                                  {record.approverName ||
                                    `审批人 #${record.approverId}`}
                                </span>
                                <Tag
                                  color={isApprove ? 'green' : 'red'}
                                  className="!m-0"
                                >
                                  {isApprove ? '审批通过' : '驳回'}
                                </Tag>
                                <Tag className="!m-0" color="default">
                                  节点 #{record.nodeIndex + 1}
                                </Tag>
                                <Tag className="!m-0" color="default">
                                  耗时：{formatDuration(duration)}
                                </Tag>
                                <span className="text-xs text-slate-400 ml-auto font-mono">
                                  {record.createdAt}
                                </span>
                              </div>
                              {record.comment && (
                                <div className="mt-2 ml-10 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                                  <Text className="text-sm text-slate-600">
                                    {record.comment}
                                  </Text>
                                </div>
                              )}
                            </div>
                          ),
                        };
                      });
                    })()}
                  />
                )}
              </Card>
            </>
          )
        )}
      </Spin>
    </div>
  );
}
