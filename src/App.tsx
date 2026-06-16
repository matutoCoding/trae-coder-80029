import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import MainLayout from '@/layouts/MainLayout';
import Dashboard from '@/pages/Dashboard';
import CycleRules from '@/pages/CycleRules';
import ApprovalRoutes from '@/pages/ApprovalRoutes';
import ApprovalChain from '@/pages/ApprovalChain';
import BenchList from '@/pages/BenchList';
import BenchDetail from '@/pages/BenchDetail';
import MyBookings from '@/pages/MyBookings';
import ToApprove from '@/pages/ToApprove';
import AccessCheckin from '@/pages/AccessCheckin';
import ScheduleCalendar from '@/pages/ScheduleCalendar';

dayjs.locale('zh-cn');

const theme = {
  token: {
    colorPrimary: '#1677ff',
    colorInfo: '#1677ff',
    colorLink: '#1677ff',
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#001529',
      bodyBg: '#f5f7fa',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: '#1677ff',
    },
  },
};

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntdApp>
        <Router>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/benches" element={<BenchList />} />
              <Route path="/benches/:id" element={<BenchDetail />} />
              <Route path="/cycle-rules" element={<CycleRules />} />
              <Route path="/approval-routes" element={<ApprovalRoutes />} />
              <Route path="/approval-chains/:bookingId" element={<ApprovalChain />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/to-approve" element={<ToApprove />} />
              <Route path="/access-checkin" element={<AccessCheckin />} />
              <Route path="/schedule-calendar" element={<ScheduleCalendar />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
}
