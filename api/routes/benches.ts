import { Router, type Request, type Response } from 'express';
import { benchRepo, slotRepo } from '../repositories/repos.js';
import type { Bench, TimeSlot } from '../../shared/types.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  try {
    const { riskLevel, status, keyword } = req.query as {
      riskLevel?: string;
      status?: string;
      keyword?: string;
    };
    const list = benchRepo.findAll({ riskLevel, status, keyword });
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const item = benchRepo.findById(id);
    if (!item) {
      res.json({ success: false, message: '实验台不存在' });
      return;
    }
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/', (req: Request, res: Response): void => {
  try {
    const body = req.body as Omit<Bench, 'id' | 'createdAt'>;
    if (!body.name || !body.code) {
      res.json({ success: false, message: '名称和编号必填' });
      return;
    }
    const id = benchRepo.create(body);
    res.json({ success: true, data: { id }, message: '创建成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const exist = benchRepo.findById(id);
    if (!exist) {
      res.json({ success: false, message: '实验台不存在' });
      return;
    }
    const body = req.body as Partial<Omit<Bench, 'id' | 'createdAt'>>;
    benchRepo.update(id, body);
    res.json({ success: true, message: '更新成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const exist = benchRepo.findById(id);
    if (!exist) {
      res.json({ success: false, message: '实验台不存在' });
      return;
    }
    benchRepo.remove(id);
    res.json({ success: true, message: '删除成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/:id/slots', (req: Request, res: Response): void => {
  try {
    const benchId = Number(req.params.id);
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    if (!startDate || !endDate) {
      res.json({ success: false, message: 'startDate 和 endDate 必填' });
      return;
    }
    const list = slotRepo.findByBenchAndRange(benchId, startDate, endDate);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

interface SlotUpdateItem {
  id: number;
  status?: string;
  startTime?: string;
  endTime?: string;
  date?: string;
}

router.patch('/:id/slots', (req: Request, res: Response): void => {
  try {
    const benchId = Number(req.params.id);
    const exist = benchRepo.findById(benchId);
    if (!exist) {
      res.json({ success: false, message: '实验台不存在' });
      return;
    }
    const { ids, updates } = req.body as {
      ids?: number[];
      updates?: SlotUpdateItem | SlotUpdateItem[];
    };
    if (ids && updates && !Array.isArray(updates)) {
      const u = updates as SlotUpdateItem;
      for (const id of ids) {
        slotRepo.update(id, {
          status: u.status as any,
          startTime: u.startTime,
          endTime: u.endTime,
          date: u.date,
        });
      }
      res.json({ success: true, message: `批量更新了 ${ids.length} 条时段` });
      return;
    }
    if (Array.isArray(updates)) {
      for (const u of updates) {
        slotRepo.update(u.id, {
          status: u.status as any,
          startTime: u.startTime,
          endTime: u.endTime,
          date: u.date,
        });
      }
      res.json({ success: true, message: `更新了 ${updates.length} 条时段` });
      return;
    }
    res.json({ success: false, message: '参数格式错误' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
