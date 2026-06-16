import { Router, type Request, type Response } from 'express';
import { cycleRuleRepo, benchRepo, slotRepo } from '../repositories/repos.js';
import type { CycleRule, TimeSlot } from '../../shared/types.js';
import dayjs from 'dayjs';

const router = Router();

function generateSlotDates(rule: CycleRule): string[] {
  const dates: string[] = [];
  let cur = dayjs(rule.startDate);
  const end = dayjs(rule.endDate);
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    const dow = cur.day();
    if (rule.weekdays.includes(dow)) {
      dates.push(cur.format('YYYY-MM-DD'));
    }
    cur = cur.add(1, 'day');
  }
  return dates;
}

function buildSlots(rule: CycleRule): Omit<TimeSlot, 'id'>[] {
  const dates = generateSlotDates(rule);
  return dates.map((d) => ({
    benchId: rule.benchId,
    date: d,
    startTime: rule.startTime,
    endTime: rule.endTime,
    status: 'available' as const,
    bookingId: undefined,
  }));
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const list = cycleRuleRepo.findAll();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const item = cycleRuleRepo.findById(id);
    if (!item) {
      res.json({ success: false, message: '周期规则不存在' });
      return;
    }
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/', (req: Request, res: Response): void => {
  try {
    const body = req.body as Omit<CycleRule, 'id'>;
    if (!body.benchId || !body.name || !body.weekdays?.length) {
      res.json({ success: false, message: '实验台、名称、星期必填' });
      return;
    }
    const bench = benchRepo.findById(body.benchId);
    if (!bench) {
      res.json({ success: false, message: '实验台不存在' });
      return;
    }
    const id = cycleRuleRepo.create(body);
    res.json({ success: true, data: { id }, message: '创建成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const exist = cycleRuleRepo.findById(id);
    if (!exist) {
      res.json({ success: false, message: '周期规则不存在' });
      return;
    }
    cycleRuleRepo.remove(id);
    res.json({ success: true, message: '删除成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/:id/preview', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const rule = cycleRuleRepo.findById(id);
    if (!rule) {
      res.json({ success: false, message: '周期规则不存在' });
      return;
    }
    const slots = buildSlots(rule);
    const dates = [...new Set(slots.map((s) => s.date))];
    res.json({
      success: true,
      data: {
        previewCount: slots.length,
        uniqueDates: dates.length,
        sampleDates: dates.slice(0, 10),
        startDate: rule.startDate,
        endDate: rule.endDate,
      },
    });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/:id/generate', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const rule = cycleRuleRepo.findById(id);
    if (!rule) {
      res.json({ success: false, message: '周期规则不存在' });
      return;
    }
    const slots = buildSlots(rule);
    const count = slotRepo.upsertMany(slots);
    res.json({
      success: true,
      data: { generated: count, total: slots.length },
      message: `成功生成 ${count} 条时段记录（共 ${slots.length} 条，已存在的跳过）`,
    });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
