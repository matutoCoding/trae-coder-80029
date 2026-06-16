import {
  Layout,
  Menu,
  Breadcrumb,
  Avatar,
  Dropdown,
  Button,
  Space,
  Typography,
  Tag,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  ScheduleOutlined,
  BranchesOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  LoginOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useGlobalStore } from '@/store/globalStore';
import { useUserStore } from '@/store/userStore';
import { ROLE_LABEL, User } from 'shared/types';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: <Link to="/dashboard">仪表盘</Link>,
  },
  {
    key: '/benches',
    icon: <ExperimentOutlined />,
    label: <Link to="/benches">实验台列表</Link>,
  },
  {
    key: '/cycle-rules',
    icon: <ScheduleOutlined />,
    label: <Link to="/cycle-rules">周期规则</Link>,
  },
  {
    key: '/approval-routes',
    icon: <BranchesOutlined />,
    label: <Link to="/approval-routes">审批路由</Link>,
  },
  {
    key: '/my-bookings',
    icon: <FileTextOutlined />,
    label: <Link to="/my-bookings">我的预约</Link>,
  },
  {
    key: '/to-approve',
    icon: <CheckCircleOutlined />,
    label: <Link to="/to-approve">待我审批</Link>,
  },
  {
    key: '/access-checkin',
    icon: <LoginOutlined />,
    label: <Link to="/access-checkin">准入登记</Link>,
  },
];

const pathTitleMap: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/benches': '实验台列表',
  '/cycle-rules': '周期规则',
  '/approval-routes': '审批路由',
  '/my-bookings': '我的预约',
  '/to-approve': '待我审批',
  '/access-checkin': '准入登记',
};

function getBreadcrumbs(pathname: string) {
  const result: { title: string; path?: string }[] = [
    { title: '首页', path: '/dashboard' },
  ];

  if (pathname === '/dashboard') {
    return result;
  }

  if (pathname.startsWith('/benches/') && pathname !== '/benches') {
    result.push({ title: '实验台列表', path: '/benches' });
    result.push({ title: '实验台详情' });
  } else if (pathname.startsWith('/approval-chains/')) {
    result.push({ title: '审批链路' });
  } else {
    const title = pathTitleMap[pathname];
    if (title) {
      result.push({ title });
    }
  }

  return result;
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/benches/') && pathname !== '/benches') {
    return '实验台详情';
  }
  if (pathname.startsWith('/approval-chains/')) {
    return '审批链路';
  }
  return pathTitleMap[pathname] || '页面';
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    sidebarCollapsed,
    breadcrumbs,
    pageTitle,
    toggleSidebar,
    setBreadcrumbs,
    setPageTitle,
  } = useGlobalStore();

  const { currentUser, users, switchUser, logout } = useUserStore();

  useEffect(() => {
    const newBreadcrumbs = getBreadcrumbs(location.pathname);
    const newTitle = getPageTitle(location.pathname);
    setBreadcrumbs(newBreadcrumbs);
    setPageTitle(newTitle);
  }, [location.pathname, setBreadcrumbs, setPageTitle]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'switch-title',
      type: 'group',
      label: '切换角色登录',
    },
    ...users.map((user: User) => ({
      key: `user-${user.id}`,
      icon:
        user.id === currentUser.id ? <CheckCircleOutlined /> : <UserOutlined />,
      label: (
        <span className="flex items-center gap-2">
          {user.name}
          <Tag color="blue">{ROLE_LABEL[user.role]}</Tag>
        </span>
      ),
      onClick: () => switchUser(user.id),
      disabled: user.id === currentUser.id,
    })),
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={232}
        theme="dark"
        className="bg-gradient-to-b from-slate-900 to-slate-800"
      >
        <div className="h-16 flex items-center justify-center px-4 border-b border-white/10">
          <ExperimentOutlined className="text-2xl text-blue-400 mr-2" />
          {!sidebarCollapsed && (
            <span className="text-white font-semibold text-lg whitespace-nowrap">
              实验室预约系统
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0 mt-2"
        />
      </Sider>
      <Layout>
        <Header className="bg-white px-6 flex items-center justify-between shadow-sm h-16">
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={
                sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
              }
              onClick={toggleSidebar}
              className="!text-slate-600 hover:!text-blue-600"
            />
            <Breadcrumb
              className="!m-0"
              items={breadcrumbs.map((item) => ({
                title: item.path ? (
                  <Link to={item.path}>{item.title}</Link>
                ) : (
                  item.title
                ),
              }))}
            />
          </div>
          <Space size={16}>
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors">
                <Avatar
                  size={36}
                  icon={<UserOutlined />}
                  className="!bg-gradient-to-br !from-blue-500 !to-indigo-600"
                />
                <div className="text-right flex items-center gap-2">
                  <span className="font-medium text-slate-800 text-sm">
                    {currentUser.name}
                  </span>
                  <Tag color="blue">{ROLE_LABEL[currentUser.role]}</Tag>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content className="m-6">
          <div className="mb-6">
            <Title level={3} className="!m-0 !text-slate-800">
              {pageTitle}
            </Title>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm min-h-[calc(100vh-12rem)]">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
