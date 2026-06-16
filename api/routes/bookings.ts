import { Router, type Request, type Response } from 'express';
import { bookingRepo, userRepo, routeRepo } from '../repositories/repos.js';
import {
  submitBooking,
  processApproval,
  buildApprovalChain,
  enrichBooking,
  checkInBooking,
  matchRoute,
  cancelBooking,
  findApprovedBookings,
} from '../services/bookingService.js';
import type { BookingSubmitData } from '../services/bookingService.js';
import type { Booking } from '../../shared/types.js';

const router = Router();

router.post('/', (req: Request, res: Response): void => {
  try {
    const body = req.body as BookingSubmitData;
    if (!body.benchId || !body.applicantId || !body.tutorId || !body.slotIds?.length) {
      res.json({ success: false, message: '实验台、申请人、导师、时段必填' });
      return;
    }
    const booking = submitBooking(body);
    const enriched = enrichBooking(booking);
    res.json({ success: true, data: enriched, message: '提交成功，等待审批' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/match-route', (req: Request, res: Response): void => {
  try {
    const body = req.body as BookingSubmitData;
    const route = matchRoute(body);
    if (!route) {
      res.json({ success: false, message: '未匹配到审批路由' });
      return;
    }
    res.json({ success: true, data: route });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/mine/:userId', (req: Request, res: Response): void => {
  try {
    const userId = Number(req.params.userId);
    const list = bookingRepo.findByApplicant(userId).map(enrichBooking);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/pending/:userId', (req: Request, res: Response): void => {
  try {
    const userId = Number(req.params.userId);
    const user = userRepo.findById(userId);
    if (!user) {
      res.json({ success: false, message: '用户不存在' });
      return;
    }
    const list = bookingRepo.findByApproverRole(userId, user.role).map(enrichBooking);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/approved/:userId', (req: Request, res: Response): void => {
  try {
    const userId = Number(req.params.userId);
    const list = findApprovedBookings(userId);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/:id/cancel', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const { userId } = req.body as { userId: number };
    if (!userId) {
      res.json({ success: false, message: 'userId 必填' });
      return;
    }
    const updated = cancelBooking(id, userId);
    const enriched = enrichBooking(updated);
    res.json({ success: true, data: enriched, message: '取消成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const booking = bookingRepo.findById(id);
    if (!booking) {
      res.json({ success: false, message: '预约不存在' });
      return;
    }
    const enriched = enrichBooking(booking);
    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/', (req: Request, res: Response): void => {
  try {
    const list = bookingRepo.findAll().map(enrichBooking);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/remind', (req: Request, res: Response): void => {
  try {
    const { bookingId, targetRole } = req.body as {
      bookingId: number;
      targetRole: string;
    };
    if (!bookingId || !targetRole) {
      res.json({ success: false, message: 'bookingId 和 targetRole 必填' });
      return;
    }
    const booking = bookingRepo.findById(bookingId);
    if (!booking) {
      res.json({ success: false, message: '预约不存在' });
      return;
    }
    console.log(`[催办] bookingId=${bookingId}, targetRole=${targetRole}, currentStatus=${booking.status}`);
    res.json({ success: true, message: '已发送催办提醒' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/approve', (req: Request, res: Response): void => {
  try {
    const { bookingId, approverId, comment } = req.body as {
      bookingId: number;
      approverId: number;
      comment?: string;
    };
    if (!bookingId || !approverId) {
      res.json({ success: false, message: 'bookingId 和 approverId 必填' });
      return;
    }
    const updated = processApproval({
      bookingId,
      approverId,
      action: 'approve',
      comment: comment || '',
    });
    const enriched = enrichBooking(updated);
    res.json({ success: true, data: enriched, message: '审批通过' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/reject', (req: Request, res: Response): void => {
  try {
    const { bookingId, approverId, comment } = req.body as {
      bookingId: number;
      approverId: number;
      comment?: string;
    };
    if (!bookingId || !approverId) {
      res.json({ success: false, message: 'bookingId 和 approverId 必填' });
      return;
    }
    const updated = processApproval({
      bookingId,
      approverId,
      action: 'reject',
      comment: comment || '驳回',
    });
    const enriched = enrichBooking(updated);
    res.json({ success: true, data: enriched, message: '已驳回' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/:id/chain', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const chain = buildApprovalChain(id);
    chain.booking = enrichBooking(chain.booking) as Booking;
    res.json({ success: true, data: chain });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/:id/check-in', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const { userId } = req.body as { userId: number };
    if (!userId) {
      res.json({ success: false, message: 'userId 必填' });
      return;
    }
    const updated = checkInBooking(id, userId);
    const enriched = enrichBooking(updated);
    res.json({ success: true, data: enriched, message: '签到成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
