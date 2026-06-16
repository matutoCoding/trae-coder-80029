import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  TimePicker,
  DatePicker,
  Tag,
  Drawer,
  Progress,
  Result,
  Spin,
  Empty,
  App,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import type { CycleRule, Bench, ApiResponse } from 'shared/types';

const { Title, Text } = Typography;

const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
];

const WEEKDAY_MAP: Record<number, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  0: '日',
};

interface CycleRuleFormData {
  name: string;
  benchId: number;
  weekdays: number[];
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
}

interface PreviewData {
  previewCount: number;
  uniqueDates: number;
  sampleDates: string[];
  startDate: string;
  endDate: string;
}

interface GenerateData {
  inserted: number;
  skipped: number;
  total: number;
}

export default function CycleRules() {
  const { message, modal } = App.useApp();
  const { currentUser } = useUserStore();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CycleRule[]>([]);
  const [benches, setBenches] = useState<Bench[]>([]);
  const [benchesLoading, setBenchesLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CycleRuleFormData>();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewRuleId, setPreviewRuleId] = useState<number | null>(null);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateResult, setGenerateResult] = useState<GenerateData | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<CycleRule[]>>('/cycles');
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (e: any) {
      message.error(e.message || '获取周期规则失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBenches = async () => {
    setBenchesLoading(true);
    try {
      const res = await api.get<ApiResponse<Bench[]>>('/benches');
      if (res.success && res.data) {
        setBenches(res.data.filter((b) => b.status === 'active'));
      }
    } catch (e: any) {
      message.error(e.message || '获取实验台列表失败');
    } finally {
      setBenchesLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBenches();
  }, []);

  const benchMap = benches.reduce((acc, b) => {
    acc[b.id] = b.name;
    return acc;
  }, {} as Record<number, string>);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const body: Omit<CycleRule, 'id'> = {
        name: values.name,
        benchId: values.benchId,
        weekdays: values.weekdays,
        startTime: values.startTime.format('HH:mm:ss'),
        endTime: values.endTime.format('HH:mm:ss'),
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
        status: 'active',
      };
      const res = await api.post<ApiResponse<{ id: number }>>('/cycles', body);
      if (res.success) {
        message.success('创建成功');
        setModalOpen(false);
        form.resetFields();
        fetchData();
      } else {
        message.error(res.message || '创建失败');
      }
    } catch (e: any) {
      if (e.message) message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: CycleRule) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除规则「${record.name}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await api.del<ApiResponse<void>>(`/cycles/${record.id}`);
          if (res.success) {
            message.success('删除成功');
            fetchData();
          } else {
            message.error(res.message || '删除失败');
          }
        } catch (e: any) {
          message.error(e.message || '删除失败');
        }
      },
    });
  };

  const handlePreview = async (record: CycleRule) => {
    setPreviewRuleId(record.id);
    setPreviewOpen(true);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const res = await api.post<ApiResponse<PreviewData>>(`/cycles/${record.id}/preview`);
      if (res.success && res.data) {
        setPreviewData(res.data);
      } else {
        message.error(res.message || '预览失败');
      }
    } catch (e: any) {
      message.error(e.message || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewConfirm = () => {
    if (previewRuleId != null) {
      setPreviewOpen(false);
      handleGenerate(previewRuleId);
    }
  };

  const handleGenerate = async (id: number) => {
    setGenerateOpen(true);
    setGenerateResult(null);
    setGenerateError(null);
    setGenerateProgress(0);
    setGenerateLoading(true);

    const timer = setInterval(() => {
      setGenerateProgress((prev) => Math.min(prev + 8, 90));
    }, 120);

    try {
      const res = await api.post<ApiResponse<GenerateData>>(`/cycles/${id}/generate`);
      clearInterval(timer);
      setGenerateProgress(100);
      if (res.success && res.data) {
        setGenerateResult(res.data);
        message.success(`新生成 ${res.data.inserted} 条，跳过已存在 ${res.data.skipped} 条，共 ${res.data.total} 条`);
        fetchData();
      } else {
        setGenerateError(res.message || '生成失败');
        message.error(res.message || '生成失败');
      }
    } catch (e: any) {
      clearInterval(timer);
      setGenerateError(e.message || '生成失败');
      message.error(e.message || '生成失败');
    } finally {
      setGenerateLoading(false);
      clearInterval(timer);
    }
  };

  const columns: ColumnsType<CycleRule> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '关联实验台',
      dataIndex: 'benchId',
      key: 'benchId',
      width: 160,
      render: (id: number) => benchMap[id] || `#${id}`,
    },
    {
      title: '周几',
      dataIndex: 'weekdays',
      key: 'weekdays',
      width: 200,
      render: (days: number[]) => (
        <Space wrap size={[4, 4]}>
          {days
            .slice()
            .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
            .map((d) => (
              <Tag key={d} color="blue">
                周{WEEKDAY_MAP[d]}
              </Tag>
            ))}
        </Space>
      ),
    },
    {
      title: '时间段',
      key: 'timeRange',
      width: 160,
      render: (_, r) => (
        <Text className="font-mono">
          {r.startTime.slice(0, 5)} ~ {r.endTime.slice(0, 5)}
        </Text>
      ),
    },
    {
      title: '日期范围',
      key: 'dateRange',
      width: 220,
      render: (_, r) => (
        <Text className="font-mono text-sm">
          {r.startDate} ~ {r.endDate}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: CycleRule['status']) =>
        s === 'active' ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(r)}
          >
            预览
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleGenerate(r.id)}
          >
            生成
          </Button>
          {isAdmin && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(r)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Title level={4} className="!m-0 !text-slate-800">
            周期规则配置
          </Title>
          <Text type="secondary">按周期批量生成实验台可预约时段</Text>
        </div>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            新建规则
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        <div className="bg-white rounded-lg border border-slate-100">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    <Text type="secondary">
                      暂无规则，点击右上角「新建规则」开始创建
                    </Text>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  className="py-8"
                />
              ),
            }}
          />
        </div>
      </Spin>

      <Modal
        title="新建周期规则"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
        width={640}
        maskClosable={false}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            weekdays: [1, 2, 3, 4, 5],
          }}
          preserve={false}
        >
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="如：每周工作日上午实验" maxLength={50} showCount />
          </Form.Item>

          <Form.Item
            label="关联实验台"
            name="benchId"
            rules={[{ required: true, message: '请选择实验台' }]}
          >
            <Select
              placeholder="选择实验台"
              loading={benchesLoading}
              options={benches.map((b) => ({
                label: b.name,
                value: b.id,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="星期"
            name="weekdays"
            rules={[{ required: true, message: '请选择星期' }]}
          >
            <Checkbox.Group options={WEEKDAY_OPTIONS} />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="开始时间"
              name="startTime"
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <TimePicker
                format="HH:mm"
                className="!w-full"
                placeholder="选择开始时间"
              />
            </Form.Item>
            <Form.Item
              label="结束时间"
              name="endTime"
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <TimePicker
                format="HH:mm"
                className="!w-full"
                placeholder="选择结束时间"
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="开始日期"
              name="startDate"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker className="!w-full" placeholder="选择开始日期" />
            </Form.Item>
            <Form.Item
              label="结束日期"
              name="endDate"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <DatePicker className="!w-full" placeholder="选择结束日期" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Drawer
        title="预览生成结果"
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        width={480}
        footer={
          previewData ? (
            <div className="flex justify-end gap-2">
              <Button onClick={() => setPreviewOpen(false)}>关闭</Button>
              <Button
                type="primary"
                onClick={handlePreviewConfirm}
                disabled={previewData.previewCount === 0}
              >
                确认生成
              </Button>
            </div>
          ) : null
        }
      >
        <Spin spinning={previewLoading}>
          {previewData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="text-sm text-slate-500">预计生成</div>
                  <div className="mt-1 text-2xl font-bold text-blue-600">
                    {previewData.previewCount}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">条时段（已存在的会自动跳过）</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-4">
                  <div className="text-sm text-slate-500">覆盖天数</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-600">
                    {previewData.uniqueDates}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">个不同日期</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm text-slate-500 mb-2">
                  日期范围：
                  <span className="font-mono text-slate-700">
                    {previewData.startDate} ~ {previewData.endDate}
                  </span>
                </div>
                <div className="text-sm text-slate-500 mb-3">
                  示例日期（前 {previewData.sampleDates.length} 个）：
                </div>
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                  {previewData.sampleDates.map((d) => (
                    <Tag key={d} color="blue">
                      {d}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            !previewLoading && <Empty description="暂无预览数据" />
          )}
        </Spin>
      </Drawer>

      <Modal
        title="执行生成"
        open={generateOpen}
        onCancel={() => {
          if (!generateLoading) setGenerateOpen(false);
        }}
        footer={
          generateResult || generateError ? (
            <Button type="primary" onClick={() => setGenerateOpen(false)}>
              关闭
            </Button>
          ) : null
        }
        closable={!generateLoading}
        maskClosable={false}
        width={520}
      >
        <div className="py-4">
          {!generateResult && !generateError && (
            <div className="space-y-4">
              <Progress percent={generateProgress} status="active" />
              <Text type="secondary">正在生成时段，请稍候...</Text>
            </div>
          )}
          {generateResult && (
            <Result
              status="success"
              title="生成完成"
              subTitle={
                <div className="text-sm space-y-1">
                  <div>
                    新生成{' '}
                    <span className="font-bold text-green-600">
                      {generateResult.inserted}
                    </span>{' '}
                    条
                  </div>
                  <div>
                    跳过已存在{' '}
                    <span className="font-bold text-orange-500">
                      {generateResult.skipped}
                    </span>{' '}
                    条
                  </div>
                  <div>
                    共{' '}
                    <span className="font-mono font-bold text-blue-600">
                      {generateResult.total}
                    </span>{' '}
                    条
                  </div>
                </div>
              }
            />
          )}
          {generateError && (
            <Result status="error" title="生成失败" subTitle={generateError} />
          )}
        </div>
      </Modal>
    </div>
  );
}
