export type UserRole = 'student' | 'tutor' | 'admin' | 'safety';

export interface User {
  id: number;
  name: string;
  account: string;
  role: UserRole;
  department: string;
  createdAt: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export type BenchStatus = 'active' | 'maintenance' | 'disabled';

export interface Bench {
  id: number;
  name: string;
  code: string;
  location: string;
  riskLevel: RiskLevel;
  description: string;
  status: BenchStatus;
  createdAt: string;
}

export type SlotStatus = 'available' | 'booked' | 'occupied' | 'maintenance';

export interface TimeSlot {
  id: number;
  benchId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  bookingId?: number;
}

export interface CycleRule {
  id: number;
  benchId: number;
  name: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive';
}

export interface RouteCondition {
  field: string;
  op: string;
  value: any;
}

export interface ApprovalNode {
  id: number;
  routeId: number;
  name: string;
  role: UserRole;
  orderIndex: number;
}

export interface ApprovalRoute {
  id: number;
  name: string;
  condition: RouteCondition;
  nodes: ApprovalNode[];
  status: 'active' | 'inactive';
}

export type BookingStatus =
  | 'pending'
  | 'tutor_approved'
  | 'safety_approved'
  | 'admin_approved'
  | 'approved'
  | 'rejected'
  | 'checked_in'
  | 'cancelled';

export interface Booking {
  id: number;
  benchId: number;
  applicantId: number;
  tutorId: number;
  routeId: number;
  title: string;
  riskLevel: RiskLevel;
  status: BookingStatus;
  currentNodeIndex: number;
  createdAt: string;
  slotIds: number[];
  slots?: TimeSlot[];
  bench?: Bench;
  applicant?: User;
  tutor?: User;
  route?: ApprovalRoute;
  records?: ApprovalRecord[];
}

export interface ApprovalRecord {
  id: number;
  bookingId: number;
  approverId: number;
  approverName?: string;
  nodeIndex: number;
  action: 'approve' | 'reject';
  comment: string;
  createdAt: string;
}

export interface ChainNodeState {
  node: ApprovalNode;
  status: 'pending' | 'current' | 'approved' | 'rejected' | 'skipped';
  record?: ApprovalRecord;
}

export interface ApprovalChain {
  booking: Booking;
  nodes: ChainNodeState[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: '低危',
  medium: '中危',
  high: '高危',
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  low: '#52C41A',
  medium: '#FA8C16',
  high: '#F5222D',
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: '待审批',
  tutor_approved: '导师已通过',
  safety_approved: '安全已通过',
  admin_approved: '管理员已通过',
  approved: '审批通过',
  rejected: '已驳回',
  checked_in: '已签到',
  cancelled: '已取消',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  student: '学生',
  tutor: '导师',
  admin: '管理员',
  safety: '安全员',
};
