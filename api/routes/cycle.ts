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

function getSlotKey(slot: { date: string; startTime: string; endTime: string }): string {
  return `${slot.date}|${slot.startTime}|${slot.endTime}`;
}

interface ClassifiedSlots {
  toInsert: Array<{ date: string; startTime: string; endTime: string; benchId: number }>;
  toSkip: Array<{ date: string; startTime: string; endTime: string; benchId: number }>;
  relatedBookings: Array<{ date: string; startTime: string; endTime: string; benchId: number }>;
}

function classifySlots(generated: Omit<TimeSlot, 'id'>[], existing: TimeSlot[]): ClassifiedSlots {
  const existingMap = new Map<string, TimeSlot>();
  for (const s of existing) {
    existingMap.set(getSlotKey(s), s);
  }

  const toInsert: ClassifiedSlots['toInsert'] = [];
  const toSkip: ClassifiedSlots['toSkip'] = [];
  const relatedBookings: ClassifiedSlots['relatedBookings'] = [];

  for (const slot of generated) {
    const key = getSlotKey(slot);
    const exist = existingMap.get(key);
    if (!exist) {
      toInsert.push({ date: slot.date, startTime: slot.startTime, endTime: slot.endTime, benchId: slot.benchId });
    } else if (exist.status === 'booked' || exist.status === 'occupied') {
      relatedBookings.push({ date: exist.date, startTime: exist.startTime, endTime: exist.endTime, benchId: exist.benchId });
    } else {
      toSkip.push({ date: exist.date, startTime: exist.startTime, endTime: exist.endTime, benchId: exist.benchId });
    }
  }

  return { toInsert, toSkip, relatedBookings };
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
    const existing = slotRepo.findByBenchAndSlots(
      rule.benchId,
      slots.map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime }))
    );
    const classified = classifySlots(slots, existing);

    const dates = [...new Set(slots.map((s) => s.date))];
    res.json({
      success: true,
      data: {
        previewCount: slots.length,
        uniqueDates: dates.length,
        sampleDates: dates.slice(0, 10),
        startDate: rule.startDate,
        endDate: rule.endDate,
        insertCount: classified.toInsert.length,
        skipCount: classified.toSkip.length,
        bookingRelatedCount: classified.relatedBookings.length,
        total: slots.length,
        toInsert: {
          count: classified.toInsert.length,
          sample: classified.toInsert.slice(0, 5),
        },
        toSkip: {
          count: classified.toSkip.length,
          sample: classified.toSkip.slice(0, 5),
        },
        relatedBookings: {
          count: classified.relatedBookings.length,
          sample: classified.relatedBookings.slice(0, 5),
        },
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
    const existing = slotRepo.findByBenchAndSlots(
      rule.benchId,
      slots.map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime }))
    );
    const classified = classifySlots(slots, existing);
    const result = slotRepo.upsertMany(slots);
    res.json({
      success: true,
      data: {
        inserted: result.inserted,
        skipped: result.skipped,
        bookingRelatedCount: classified.relatedBookings.length,
        total: slots.length,
        details: {
          inserted: classified.toInsert.slice(0, 10),
          skipped: classified.toSkip.slice(0, 10),
          bookingRelated: classified.relatedBookings.slice(0, 10),
          insertedTotal: classified.toInsert.length,
          skippedTotal: classified.toSkip.length,
          bookingRelatedTotal: classified.relatedBookings.length,
        },
      },
      message: `新生成 ${result.inserted} 条，跳过已存在 ${result.skipped} 条，共 ${slots.length} 条`,
    });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
