import type {
  ApprovalRoute,
  ApprovalNode,
  Booking,
  BookingStatus,
  RouteCondition,
  ChainNodeState,
  ApprovalChain,
  ApprovalRecord,
  User,
} from '../../shared/types.js';
import { routeRepo, userRepo, recordRepo, bookingRepo, benchRepo, slotRepo } from '../repositories/repos.js';

export interface BookingSubmitData {
  benchId: number;
  applicantId: number;
  tutorId: number;
  title: string;
  riskLevel: 'low' | 'medium' | 'high';
  slotIds: number[];
}

export interface ApproveData {
  bookingId: number;
  approverId: number;
  action: 'approve' | 'reject';
  comment: string;
}

function evalCondition(condition: RouteCondition, ctx: Record<string, any>): boolean {
  const { field, op, value } = condition;
  const actual = ctx[field];
  switch (op) {
    case 'eq':
    case '==':
      return actual === value;
    case 'ne':
    case '!=':
      return actual !== value;
    case 'in':
      return Array.isArray(value) && value.includes(actual);
    case 'not_in':
      return Array.isArray(value) && !value.includes(actual);
    case 'gt':
      return actual > value;
    case 'gte':
      return actual >= value;
    case 'lt':
      return actual < value;
    case 'lte':
      return actual <= value;
    default:
      return false;
  }
}

export function matchRoute(submit: BookingSubmitData): ApprovalRoute | null {
  const routes = routeRepo.findActiveRoutes();
  const ctx: Record<string, any> = {
    riskLevel: submit.riskLevel,
    benchId: submit.benchId,
  };
  for (const route of routes) {
    if (evalCondition(route.condition, ctx)) {
      return route;
    }
  }
  return null;
}

export function getNextNode(route: ApprovalRoute, currentIndex: number): ApprovalNode | null {
  const sorted = [...route.nodes].sort((a, b) => a.orderIndex - b.orderIndex);
  const nextOrder = currentIndex + 1;
  return sorted.find((n) => n.orderIndex === nextOrder) || null;
}

function buildStatus(route: ApprovalRoute, currentNodeIndex: number, lastAction?: 'approve' | 'reject'): BookingStatus {
  if (lastAction === 'reject') return 'rejected';
  const sorted = [...route.nodes].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sorted.length === 0) return 'approved';
  const next = getNextNode(route, currentNodeIndex);
  if (!next) return 'approved';
  if (currentNodeIndex <= 0) return 'pending';
  switch (next.role) {
    case 'tutor':
      return 'tutor_approved';
    case 'safety':
      return 'safety_approved';
    case 'admin':
      return 'admin_approved';
    default:
      return 'pending';
  }
}

export function submitBooking(submit: BookingSubmitData): Booking {
  const route = matchRoute(submit);
  if (!route) {
    throw new Error('未匹配到审批路由，请联系管理员配置');
  }
  const bench = benchRepo.findById(submit.benchId);
  if (!bench) throw new Error('实验台不存在');
  const slots = slotRepo.findByIds(submit.slotIds);
  if (slots.length !== submit.slotIds.length) throw new Error('部分时段不存在');
  for (const s of slots) {
    if (s.benchId !== submit.benchId) throw new Error('时段不属于该实验台');
    if (s.status !== 'available') throw new Error('时段已被占用');
  }
  const applicant = userRepo.findById(submit.applicantId);
  if (!applicant) throw new Error('申请人不存在');
  const tutor = userRepo.findById(submit.tutorId);
  if (!tutor || tutor.role !== 'tutor') throw new Error('导师不存在或角色错误');

  const initialIndex = 0;
  const status = buildStatus(route, initialIndex);

  const bookingId = bookingRepo.create({
    benchId: submit.benchId,
    applicantId: submit.applicantId,
    tutorId: submit.tutorId,
    routeId: route.id,
    title: submit.title,
    riskLevel: submit.riskLevel,
    status,
    currentNodeIndex: initialIndex,
    slotIds: submit.slotIds,
  });

  const created = bookingRepo.findById(bookingId);
  if (!created) throw new Error('创建预约失败');
  return created;
}

export function processApproval(data: ApproveData): Booking {
  const booking = bookingRepo.findById(data.bookingId);
  if (!booking) throw new Error('预约不存在');
  if (booking.status === 'rejected' || booking.status === 'cancelled' || booking.status === 'checked_in') {
    throw new Error('当前状态不可审批');
  }
  const route = routeRepo.findById(booking.routeId);
  if (!route) throw new Error('审批路由不存在');
  const nextNode = getNextNode(route, booking.currentNodeIndex);
  if (!nextNode) throw new Error('没有待审批节点');
  const approver = userRepo.findById(data.approverId);
  if (!approver) throw new Error('审批人不存在');
  if (approver.role !== nextNode.role) throw new Error('无权审批该节点');
  if (nextNode.role === 'tutor' && approver.id !== booking.tutorId) {
    throw new Error('非指定导师，无权审批');
  }

  const nodeIndex = nextNode.orderIndex;
  recordRepo.create({
    bookingId: data.bookingId,
    approverId: data.approverId,
    nodeIndex,
    action: data.action,
    comment: data.comment,
  });

  let newIndex = booking.currentNodeIndex;
  if (data.action === 'approve') {
    newIndex = nodeIndex;
  }

  const newStatus = buildStatus(route, newIndex, data.action);
  bookingRepo.updateStatus(data.bookingId, newStatus, newIndex);

  if (data.action === 'reject') {
    slotRepo.setBookingForSlots(booking.slotIds, null);
  }

  const updated = bookingRepo.findById(data.bookingId);
  if (!updated) throw new Error('更新预约失败');
  return updated;
}

export function buildApprovalChain(bookingId: number): ApprovalChain {
  const booking = bookingRepo.findById(bookingId);
  if (!booking) throw new Error('预约不存在');
  const route = routeRepo.findById(booking.routeId);
  if (!route) throw new Error('审批路由不存在');
  const records = recordRepo.findByBooking(bookingId);
  const sortedNodes = [...route.nodes].sort((a, b) => a.orderIndex - b.orderIndex);

  const nodes: ChainNodeState[] = sortedNodes.map((node) => {
    const record = records.find((r) => r.nodeIndex === node.orderIndex);
    let status: ChainNodeState['status'] = 'pending';
    if (node.orderIndex <= booking.currentNodeIndex) {
      status = record?.action === 'reject' ? 'rejected' : 'approved';
    } else if (node.orderIndex === booking.currentNodeIndex + 1) {
      if (booking.status === 'rejected') {
        status = record?.action === 'reject' ? 'rejected' : 'skipped';
      } else {
        status = 'current';
      }
    } else if (booking.status === 'rejected') {
      status = 'skipped';
    }
    return { node, status, record };
  });

  return { booking, nodes };
}

export function enrichBooking(booking: Booking): Booking & {
  bench?: any;
  applicant?: User;
  tutor?: User;
  route?: ApprovalRoute;
  records?: ApprovalRecord[];
  slots?: any[];
} {
  const bench = benchRepo.findById(booking.benchId);
  const applicant = userRepo.findById(booking.applicantId);
  const tutor = userRepo.findById(booking.tutorId);
  const route = routeRepo.findById(booking.routeId);
  const records = recordRepo.findByBooking(booking.id);
  const slots = slotRepo.findByIds(booking.slotIds);
  return { ...booking, bench, applicant, tutor, route, records, slots };
}

export function checkInBooking(bookingId: number, userId: number): Booking {
  const booking = bookingRepo.findById(bookingId);
  if (!booking) throw new Error('预约不存在');
  if (booking.applicantId !== userId) throw new Error('非预约申请人无法签到');
  if (booking.status !== 'approved') throw new Error('预约未通过审批，无法签到');
  bookingRepo.updateStatus(bookingId, 'checked_in', booking.currentNodeIndex);
  slotRepo.bulkUpdateStatus(booking.slotIds, 'occupied');
  const updated = bookingRepo.findById(bookingId);
  if (!updated) throw new Error('签到失败');
  return updated;
}

export function cancelBooking(bookingId: number, userId: number): Booking {
  const booking = bookingRepo.findById(bookingId);
  if (!booking) throw new Error('预约不存在');
  if (booking.applicantId !== userId) throw new Error('非预约申请人无法取消');
  if (booking.status !== 'pending' && booking.status !== 'tutor_approved' && booking.status !== 'safety_approved' && booking.status !== 'admin_approved') {
    throw new Error('当前状态不可取消');
  }
  bookingRepo.cancel(bookingId);
  const updated = bookingRepo.findById(bookingId);
  if (!updated) throw new Error('取消失败');
  return updated;
}

export function findApprovedBookings(approverId: number): (Booking & {
  bench?: any;
  applicant?: User;
  tutor?: User;
  route?: ApprovalRoute;
  records?: ApprovalRecord[];
  slots?: any[];
})[] {
  return bookingRepo.findByApprover(approverId).map(enrichBooking);
}
