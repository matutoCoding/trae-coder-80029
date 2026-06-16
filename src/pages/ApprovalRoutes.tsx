import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Timeline,
  Popconfirm,
  Row,
  Col,
  Empty,
  App,
  Typography,
  Spin,
  Tooltip,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  NodeIndexOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import type {
  ApprovalRoute,
  ApprovalNode,
  ApiResponse,
  UserRole,
  RouteCondition,
} from 'shared/types';
import { ROLE_LABEL, RISK_COLOR, RISK_LABEL } from 'shared/types';

const { Title, Text } = Typography;

const CONDITION_FIELDS = [
  { label: '危险等级', value: 'riskLevel' },
  { label: '实验台ID', value: 'benchId' },
  { label: '申请人ID', value: 'applicantId' },
];

const CONDITION_OPS = [
  { label: '等于 (==)', value: '==' },
  { label: '不等于 (!=)', value: '!=' },
  { label: '大于 (>)', value: '>' },
  { label: '小于 (<)', value: '<' },
  { label: '大于等于 (>=)', value: '>=' },
  { label: '小于等于 (<=)', value: '<=' },
];

const RISK_OPTIONS = [
  { label: '低危', value: 'low' },
  { label: '中危', value: 'medium' },
  { label: '高危', value: 'high' },
];

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: '学生', value: 'student' },
  { label: '导师', value: 'tutor' },
  { label: '安全员', value: 'safety' },
  { label: '管理员', value: 'admin' },
];

interface RouteCardStyle {
  borderColor: string;
  headerBg: string;
  accentColor: string;
}

const ROUTE_STYLES: Record<string, RouteCardStyle> = {
  low: {
    borderColor: 'border-emerald-300',
    headerBg: 'bg-emerald-50',
    accentColor: RISK_COLOR.low,
  },
  medium: {
    borderColor: 'border-orange-300',
    headerBg: 'bg-orange-50',
    accentColor: RISK_COLOR.medium,
  },
  high: {
    borderColor: 'border-red-300',
    headerBg: 'bg-red-50',
    accentColor: RISK_COLOR.high,
  },
};

function getCardStyle(route: ApprovalRoute): RouteCardStyle {
  if (route.condition?.field === 'riskLevel') {
    const v = String(route.condition.value);
    if (ROUTE_STYLES[v]) return ROUTE_STYLES[v];
  }
  return {
    borderColor: 'border-slate-200',
    headerBg: 'bg-slate-50',
    accentColor: '#64748b',
  };
}

function formatCondition(c: RouteCondition | undefined): string {
  if (!c) return '';
  let val = c.value;
  if (c.field === 'riskLevel' && typeof val === 'string') {
    val = RISK_LABEL[val as keyof typeof RISK_LABEL] || val;
  }
  return `${c.field} ${c.op} ${val}`;
}

interface NewRouteForm {
  name: string;
  conditionField: string;
  conditionOp: string;
  conditionValue: string | number;
}

export default function ApprovalRoutes() {
  const { message, modal } = App.useApp();
  const { currentUser } = useUserStore();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApprovalRoute[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<NewRouteForm>();
  const [tempNodes, setTempNodes] = useState<Omit<ApprovalNode, 'id' | 'routeId'>[]>(
    []
  );
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNodeIdx, setEditingNodeIdx] = useState<number | null>(null);
  const [nodeForm] = Form.useForm<{ name: string; role: UserRole }>();

  const [savingMap, setSavingMap] = useState<Record<number, boolean>>({});

  const [cardNodeModalOpen, setCardNodeModalOpen] = useState(false);
  const [cardNodeEditing, setCardNodeEditing] = useState<{ route: ApprovalRoute; idx: number } | null>(null);
  const [cardNodeIsAdd, setCardNodeIsAdd] = useState(false);
  const [cardNodeRoute, setCardNodeRoute] = useState<ApprovalRoute | null>(null);
  const [cardNodeForm] = Form.useForm<{ name: string; role: UserRole }>();
  const [cardNodeSubmitting, setCardNodeSubmitting] = useState(false);

  const isAdmin = currentUser.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ApprovalRoute[]>>('/routes');
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (e: any) {
      message.error(e.message || '获取审批路由失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    form.resetFields();
    setTempNodes([]);
    setModalOpen(true);
  };

  const openAddNode = () => {
    setEditingNodeIdx(null);
    nodeForm.resetFields();
    setNodeModalOpen(true);
  };

  const openEditNode = (idx: number) => {
    setEditingNodeIdx(idx);
    nodeForm.setFieldsValue({
      name: tempNodes[idx].name,
      role: tempNodes[idx].role,
    });
    setNodeModalOpen(true);
  };

  const handleSaveNode = async () => {
    try {
      const vals = await nodeForm.validateFields();
      if (editingNodeIdx != null) {
        setTempNodes((prev) => {
          const next = [...prev];
          next[editingNodeIdx] = { ...next[editingNodeIdx], ...vals };
          return next;
        });
      } else {
        setTempNodes((prev) => [
          ...prev,
          { ...vals, orderIndex: prev.length + 1 },
        ]);
      }
      setNodeModalOpen(false);
      nodeForm.resetFields();
    } catch {
      // 校验失败
    }
  };

  const removeTempNode = (idx: number) => {
    setTempNodes((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((n, i) => ({ ...n, orderIndex: i + 1 }))
    );
  };

  const moveTempNode = (idx: number, dir: 'up' | 'down') => {
    setTempNodes((prev) => {
      const next = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((n, i) => ({ ...n, orderIndex: i + 1 }));
    });
  };

  const handleCreate = async () => {
    try {
      const vals = await form.validateFields();
      if (tempNodes.length === 0) {
        message.warning('请至少添加一个审批节点');
        return;
      }
      setSubmitting(true);
      const body = {
        name: vals.name,
        condition: {
          field: vals.conditionField,
          op: vals.conditionOp,
          value: vals.conditionValue,
        },
        nodes: tempNodes,
        status: 'active' as const,
      };
      const res = await api.post<ApiResponse<{ id: number }>>('/routes', body);
      if (res.success) {
        message.success('创建成功');
        setModalOpen(false);
        form.resetFields();
        setTempNodes([]);
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

  const handleToggleStatus = async (
    route: ApprovalRoute,
    checked: boolean
  ) => {
    try {
      const res = await api.put<ApiResponse<void>>(`/routes/${route.id}`, {
        status: checked ? 'active' : 'inactive',
      });
      if (res.success) {
        message.success(checked ? '已启用' : '已停用');
        fetchData();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleDelete = (route: ApprovalRoute) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除路由「${route.name}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await api.del<ApiResponse<void>>(`/routes/${route.id}`);
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

  const moveCardNode = (route: ApprovalRoute, idx: number, dir: 'up' | 'down') => {
    const newNodes = [...route.nodes];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= newNodes.length) return;
    [newNodes[idx], newNodes[target]] = [newNodes[target], newNodes[idx]];
    const renumbered = newNodes.map((n, i) => ({ ...n, orderIndex: i + 1 }));
    saveRouteNodes(route, renumbered);
  };

  const removeCardNode = (route: ApprovalRoute, idx: number) => {
    if (route.nodes.length <= 1) {
      message.warning('至少保留一个节点');
      return;
    }
    const newNodes = route.nodes
      .filter((_, i) => i !== idx)
      .map((n, i) => ({ ...n, orderIndex: i + 1 }));
    saveRouteNodes(route, newNodes);
  };

  const editCardNode = (route: ApprovalRoute, idx: number, name: string, role: UserRole) => {
    const newNodes = [...route.nodes];
    newNodes[idx] = { ...newNodes[idx], name, role };
    saveRouteNodes(route, newNodes);
  };

  const addCardNode = (route: ApprovalRoute) => {
    setCardNodeIsAdd(true);
    setCardNodeRoute(route);
    setCardNodeEditing(null);
    cardNodeForm.resetFields();
    setCardNodeModalOpen(true);
  };

  const openEditCardNode = (route: ApprovalRoute, idx: number) => {
    const node = route.nodes[idx];
    setCardNodeIsAdd(false);
    setCardNodeRoute(route);
    setCardNodeEditing({ route, idx });
    cardNodeForm.setFieldsValue({ name: node.name, role: node.role });
    setCardNodeModalOpen(true);
  };

  const handleCardNodeSave = async () => {
    if (!cardNodeRoute) return;
    try {
      const vals = await cardNodeForm.validateFields();
      setCardNodeSubmitting(true);
      if (cardNodeIsAdd) {
        const newNodes = [
          ...cardNodeRoute.nodes,
          {
            id: 0,
            routeId: cardNodeRoute.id,
            name: vals.name,
            role: vals.role,
            orderIndex: cardNodeRoute.nodes.length + 1,
          },
        ];
        await saveRouteNodes(cardNodeRoute, newNodes);
      } else if (cardNodeEditing) {
        const newNodes = [...cardNodeEditing.route.nodes];
        newNodes[cardNodeEditing.idx] = {
          ...newNodes[cardNodeEditing.idx],
          name: vals.name,
          role: vals.role,
        };
        await saveRouteNodes(cardNodeEditing.route, newNodes);
      }
      setCardNodeModalOpen(false);
      cardNodeForm.resetFields();
    } catch {
    } finally {
      setCardNodeSubmitting(false);
    }
  };

  const saveRouteNodes = async (
    route: ApprovalRoute,
    nodes: ApprovalNode[]
  ) => {
    setSavingMap((m) => ({ ...m, [route.id]: true }));
    try {
      const bodyNodes = nodes.map(({ id, routeId: _rid, ...rest }) => rest);
      const res = await api.put<ApiResponse<void>>(`/routes/${route.id}`, {
        nodes: bodyNodes,
      });
      if (res.success) {
        message.success('保存成功');
        fetchData();
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (e: any) {
      message.error(e.message || '保存失败');
    } finally {
      setSavingMap((m) => ({ ...m, [route.id]: false }));
    }
  };

  const getRoleColor = (role: UserRole): string => {
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
  };

  const renderNodeActions = (
    total: number,
    idx: number,
    onUp: () => void,
    onDown: () => void,
    onDel: () => void
  ) => (
    <Space size={4} className="ml-auto flex-shrink-0">
      <Tooltip title="上移">
        <Button
          size="small"
          type="text"
          icon={<ArrowUpOutlined />}
          disabled={idx === 0}
          onClick={onUp}
          className="!h-7 !w-7 !p-0"
        />
      </Tooltip>
      <Tooltip title="下移">
        <Button
          size="small"
          type="text"
          icon={<ArrowDownOutlined />}
          disabled={idx === total - 1}
          onClick={onDown}
          className="!h-7 !w-7 !p-0"
        />
      </Tooltip>
      <Popconfirm
        title="确认删除此节点？"
        okText="删除"
        okButtonProps={{ danger: true }}
        onConfirm={onDel}
      >
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          className="!h-7 !w-7 !p-0"
        />
      </Popconfirm>
    </Space>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Title level={4} className="!m-0 !text-slate-800">
            审批路由配置
          </Title>
          <Text type="secondary">
            根据条件匹配审批链路，预约提交时自动按顺序流转
          </Text>
        </div>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            新建路由
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty
            description={
              <Text type="secondary">
                暂无路由，点击右上角「新建路由」开始配置
              </Text>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="py-20"
          />
        ) : (
          <Row gutter={[20, 20]}>
            {data.map((route) => {
              const style = getCardStyle(route);
              const saving = savingMap[route.id];
              const nodesSorted = [...route.nodes].sort(
                (a, b) => a.orderIndex - b.orderIndex
              );
              return (
                <Col xs={24} lg={12} xl={8} key={route.id}>
                  <Card
                    className={`h-full border-2 ${style.borderColor} !rounded-xl shadow-sm hover:shadow-md transition-shadow`}
                    styles={{ body: { padding: 0 } }}
                  >
                    <div
                      className={`flex items-center gap-3 px-5 py-3 rounded-t-xl ${style.headerBg}`}
                    >
                      <NodeIndexOutlined
                        style={{ color: style.accentColor }}
                        className="text-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {route.name}
                        </div>
                      </div>
                      <Tooltip
                        title={route.status === 'active' ? '已启用' : '已停用'}
                      >
                        <Switch
                          size="small"
                          checked={route.status === 'active'}
                          onChange={(c) => handleToggleStatus(route, c)}
                          disabled={!isAdmin}
                        />
                      </Tooltip>
                      {isAdmin && (
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => handleDelete(route)}
                          className="!h-7 !w-7 !p-0 hover:!bg-red-50"
                        />
                      )}
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      <div
                        className="rounded-lg px-3 py-2"
                        style={{
                          backgroundColor: `${style.accentColor}10`,
                          border: `1px solid ${style.accentColor}30`,
                        }}
                      >
                        <Text
                          className="font-mono text-sm"
                          style={{ color: style.accentColor }}
                        >
                          if {formatCondition(route.condition)}
                        </Text>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-4">
                        {nodesSorted.length === 0 ? (
                          <Text type="secondary" className="text-sm">
                            暂无审批节点
                          </Text>
                        ) : (
                          <Timeline
                            className="!m-0"
                            items={nodesSorted.map((node, idx) => ({
                              dot: (
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                  style={{
                                    backgroundColor: getRoleColor(node.role),
                                  }}
                                >
                                  {idx + 1}
                                </div>
                              ),
                              color: getRoleColor(node.role),
                              children: (
                                <div className="flex items-start gap-2 pb-2 -mt-1">
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity"
                                      onClick={() =>
                                        isAdmin && openEditCardNode(route, idx)
                                      }
                                    >
                                      <span className="font-medium text-slate-800 truncate">
                                        {node.name}
                                      </span>
                                      {isAdmin && (
                                        <EditOutlined
                                          className="text-slate-400 text-xs"
                                        />
                                      )}
                                    </div>
                                    <div className="mt-1">
                                      <Tag
                                        color={getRoleColor(node.role)}
                                        className="!m-0"
                                      >
                                        {ROLE_LABEL[node.role]}
                                      </Tag>
                                    </div>
                                  </div>
                                  {isAdmin &&
                                    renderNodeActions(
                                      nodesSorted.length,
                                      idx,
                                      () => moveCardNode(route, idx, 'up'),
                                      () => moveCardNode(route, idx, 'down'),
                                      () => removeCardNode(route, idx)
                                    )}
                                </div>
                              ),
                            }))}
                          />
                        )}
                      </div>

                      {isAdmin && (
                        <>
                          <Divider className="!my-2" />
                          <div className="flex items-center justify-between">
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              size="small"
                              onClick={() => addCardNode(route)}
                              className="!border-dashed"
                            >
                              添加审批节点
                            </Button>
                            <Button
                              type="primary"
                              size="small"
                              loading={saving}
                              onClick={() => saveRouteNodes(route, route.nodes)}
                            >
                              保存
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>

      <Modal
        title="新建审批路由"
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
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="路由名称"
            name="name"
            rules={[{ required: true, message: '请输入路由名称' }]}
          >
            <Input placeholder="如：低危实验审批流程" maxLength={50} showCount />
          </Form.Item>

          <Title level={5} className="!mt-2 !mb-3">
            匹配条件
          </Title>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="conditionField"
                rules={[{ required: true, message: '必填' }]}
                initialValue="riskLevel"
              >
                <Select
                  options={CONDITION_FIELDS}
                  placeholder="字段"
                  onChange={() => {
                    form.setFieldValue('conditionValue', undefined);
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="conditionOp"
                rules={[{ required: true, message: '必填' }]}
                initialValue="=="
              >
                <Select options={CONDITION_OPS} placeholder="操作符" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="conditionValue"
                rules={[{ required: true, message: '必填' }]}
                initialValue="low"
              >
                <Select
                  options={RISK_OPTIONS}
                  placeholder="值"
                  mode={undefined}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="!my-4" />

          <div className="flex items-center justify-between mb-3">
            <Title level={5} className="!m-0">
              审批节点
              <Text type="secondary" className="ml-2 font-normal text-sm">
                （共 {tempNodes.length} 个）
              </Text>
            </Title>
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={openAddNode}
            >
              添加节点
            </Button>
          </div>

          <div className="space-y-2 mb-2">
            {tempNodes.length === 0 ? (
              <Empty
                description={
                  <Text type="secondary" className="text-sm">
                    请点击「添加节点」创建至少一个审批节点
                  </Text>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                className="!py-6"
              />
            ) : (
              tempNodes.map((n, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: getRoleColor(n.role) }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Button
                        type="link"
                        size="small"
                        className="!p-0 !h-auto font-medium text-slate-800 !min-w-0"
                        onClick={() => openEditNode(idx)}
                        icon={<EditOutlined className="text-xs" />}
                      >
                        {n.name}
                      </Button>
                    </div>
                    <Tag
                      color={getRoleColor(n.role)}
                      className="!m-0 mt-1"
                    >
                      {ROLE_LABEL[n.role]}
                    </Tag>
                  </div>
                  {renderNodeActions(
                    tempNodes.length,
                    idx,
                    () => moveTempNode(idx, 'up'),
                    () => moveTempNode(idx, 'down'),
                    () => removeTempNode(idx)
                  )}
                </div>
              ))
            )}
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingNodeIdx != null ? '编辑审批节点' : '添加审批节点'}
        open={nodeModalOpen}
        onOk={handleSaveNode}
        onCancel={() => setNodeModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={440}
        maskClosable={false}
        destroyOnClose
      >
        <Form form={nodeForm} layout="vertical" preserve={false}>
          <Form.Item
            label="节点名称"
            name="name"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="如：导师审批" maxLength={30} />
          </Form.Item>
          <Form.Item
            label="审批角色"
            name="role"
            rules={[{ required: true, message: '请选择审批角色' }]}
          >
            <Select
              options={ROLE_OPTIONS.map((r) => ({
                label: r.label,
                value: r.value,
              }))}
              placeholder="选择角色"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={cardNodeIsAdd ? '添加审批节点' : '编辑审批节点'}
        open={cardNodeModalOpen}
        onOk={handleCardNodeSave}
        onCancel={() => {
          setCardNodeModalOpen(false);
          cardNodeForm.resetFields();
        }}
        confirmLoading={cardNodeSubmitting}
        okText="确定"
        cancelText="取消"
        width={440}
        maskClosable={false}
        destroyOnClose
      >
        <Form form={cardNodeForm} layout="vertical" preserve={false}>
          <Form.Item
            label="节点名称"
            name="name"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="如：导师审批" maxLength={30} />
          </Form.Item>
          <Form.Item
            label="审批角色"
            name="role"
            rules={[{ required: true, message: '请选择审批角色' }]}
          >
            <Select
              options={ROLE_OPTIONS.map((r) => ({
                label: r.label,
                value: r.value,
              }))}
              placeholder="选择角色"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
