import { useState, useEffect } from 'react';
import {
  Input,
  Select,
  Button,
  Card,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  Radio,
  message,
  Spin,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import {
  Bench,
  RiskLevel,
  BenchStatus,
  RISK_LABEL,
  RISK_COLOR,
  ApiResponse,
} from 'shared/types';

const { Text, Paragraph } = Typography;

const statusColorMap: Record<BenchStatus, string> = {
  active: 'green',
  maintenance: 'gold',
  disabled: 'default',
};

const statusLabelMap: Record<BenchStatus, string> = {
  active: '运行中',
  maintenance: '维护中',
  disabled: '已停用',
};

interface BenchFormValues {
  name: string;
  code: string;
  location: string;
  riskLevel: RiskLevel;
  description: string;
}

export default function BenchList() {
  const navigate = useNavigate();
  const { currentUser } = useUserStore();
  const isAdmin = currentUser.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [benches, setBenches] = useState<Bench[]>([]);
  const [keyword, setKeyword] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel | undefined>();
  const [statusFilter, setStatusFilter] = useState<BenchStatus | undefined>();

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<BenchFormValues>();

  const loadBenches = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (keyword) params.keyword = keyword;
      if (riskLevel) params.riskLevel = riskLevel;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get<ApiResponse<Bench[]>>('/benches', { params });
      if (res.success && res.data) {
        setBenches(res.data);
      } else {
        message.error(res.message || '加载失败');
      }
    } catch (e: any) {
      message.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenches();
  }, []);

  const handleSearch = () => {
    loadBenches();
  };

  const handleCardClick = (id: number) => {
    navigate(`/benches/${id}`);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await api.post<ApiResponse<{ id: number }>>('/benches', {
        ...values,
        status: 'active',
      });
      if (res.success) {
        message.success('创建成功');
        setModalOpen(false);
        form.resetFields();
        loadBenches();
      } else {
        message.error(res.message || '创建失败');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索名称/编码/位置"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 260 }}
        />
        <Select
          allowClear
          placeholder="危险等级"
          value={riskLevel}
          onChange={(v) => setRiskLevel(v)}
          style={{ width: 140 }}
          options={[
            { value: 'low', label: RISK_LABEL.low },
            { value: 'medium', label: RISK_LABEL.medium },
            { value: 'high', label: RISK_LABEL.high },
          ]}
        />
        <Select
          allowClear
          placeholder="状态"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: 140 }}
          options={[
            { value: 'active', label: statusLabelMap.active },
            { value: 'maintenance', label: statusLabelMap.maintenance },
            { value: 'disabled', label: statusLabelMap.disabled },
          ]}
        />
        <Button type="primary" onClick={handleSearch}>
          搜索
        </Button>
        <div className="flex-1" />
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            新建实验台
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {benches.map((bench) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={bench.id}>
              <Card
                hoverable
                onClick={() => handleCardClick(bench.id)}
                className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                styles={{ body: { padding: 20 } }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <Text strong className="text-lg block truncate">
                      {bench.name}
                    </Text>
                  </div>
                  <Tag
                    color={statusColorMap[bench.status]}
                    className="ml-2 flex-shrink-0"
                  >
                    {statusLabelMap[bench.status]}
                  </Tag>
                </div>
                <div className="space-y-2 mb-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <BarcodeOutlined className="text-slate-400" />
                    <span className="text-slate-500 w-12">编码:</span>
                    <Text code>{bench.code}</Text>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnvironmentOutlined className="text-slate-400" />
                    <span className="text-slate-500 w-12">位置:</span>
                    <span>{bench.location}</span>
                  </div>
                </div>
                <div className="mb-3">
                  <Tag
                    style={{
                      backgroundColor: `${RISK_COLOR[bench.riskLevel]}15`,
                      color: RISK_COLOR[bench.riskLevel],
                      borderColor: RISK_COLOR[bench.riskLevel],
                      borderWidth: 1,
                    }}
                  >
                    {RISK_LABEL[bench.riskLevel]}
                  </Tag>
                </div>
                {bench.description && (
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    className="!mb-0 text-sm text-slate-500 border-t pt-3"
                  >
                    {bench.description}
                  </Paragraph>
                )}
              </Card>
            </Col>
          ))}
        </Row>
        {!loading && benches.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            暂无实验台数据
          </div>
        )}
      </Spin>

      <Modal
        title="新建实验台"
        open={modalOpen}
        onOk={handleCreateSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="实验台名称"
            name="name"
            rules={[{ required: true, message: '请输入实验台名称' }]}
          >
            <Input placeholder="请输入实验台名称" maxLength={50} />
          </Form.Item>
          <Form.Item
            label="实验台编码"
            name="code"
            rules={[{ required: true, message: '请输入实验台编码' }]}
          >
            <Input placeholder="请输入实验台编码" maxLength={30} />
          </Form.Item>
          <Form.Item
            label="位置"
            name="location"
            rules={[{ required: true, message: '请输入位置' }]}
          >
            <Input placeholder="请输入所在位置" maxLength={100} />
          </Form.Item>
          <Form.Item
            label="危险等级"
            name="riskLevel"
            rules={[{ required: true, message: '请选择危险等级' }]}
            initialValue="low"
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
          <Form.Item label="描述" name="description">
            <Input.TextArea
              placeholder="可选，描述实验台用途或注意事项"
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
