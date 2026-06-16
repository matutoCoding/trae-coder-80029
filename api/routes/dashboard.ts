import { Router, type Request, type Response } from 'express';
import db from '../database.js';
import dayjs from 'dayjs';

const router = Router();

interface Stats {
  todayBookings: number;
  weekBookings: number;
  pendingApproval: number;
  byStatus: Record<string, number>;
  benchUsage: {
    benchId: number;
    benchName: string;
    totalSlots: number;
    usedSlots: number;
    rate: number;
  }[];
}

function count(sql: string, params: any[] = []): number {
  const row = db.prepare(sql).get(...params) as any;
  return Number(row?.cnt || 0);
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
    const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

    const todayBookings = count(
      `SELECT COUNT(DISTINCT b.id) as cnt FROM bookings b
       JOIN booking_slots bs ON bs.booking_id = b.id
       JOIN time_slots ts ON ts.id = bs.slot_id
       WHERE ts.date = ?`,
      [today]
    );

    const weekBookings = count(
      `SELECT COUNT(DISTINCT b.id) as cnt FROM bookings b
       JOIN booking_slots bs ON bs.booking_id = b.id
       JOIN time_slots ts ON ts.id = bs.slot_id
       WHERE ts.date BETWEEN ? AND ?`,
      [weekStart, weekEnd]
    );

    const pendingApproval = count(
      `SELECT COUNT(*) as cnt FROM bookings
       WHERE status IN ('pending', 'tutor_approved', 'safety_approved', 'admin_approved')`
    );

    const byStatusRows = db
      .prepare('SELECT status, COUNT(*) as cnt FROM bookings GROUP BY status')
      .all() as { status: string; cnt: number }[];
    const byStatus: Record<string, number> = {};
    for (const r of byStatusRows) byStatus[r.status] = Number(r.cnt);

    const benchUsageRows = db
      .prepare(
        `SELECT b.id as benchId, b.name as benchName,
          COUNT(ts.id) as totalSlots,
          SUM(CASE WHEN ts.status IN ('booked', 'occupied') THEN 1 ELSE 0 END) as usedSlots
         FROM benches b
         LEFT JOIN time_slots ts ON ts.bench_id = b.id
         WHERE ts.date BETWEEN ? AND ?
         GROUP BY b.id, b.name`
      )
      .all(weekStart, weekEnd) as {
      benchId: number;
      benchName: string;
      totalSlots: number;
      usedSlots: number;
    }[];
    const benchUsage = benchUsageRows.map((r) => ({
      benchId: r.benchId,
      benchName: r.benchName,
      totalSlots: Number(r.totalSlots),
      usedSlots: Number(r.usedSlots),
      rate: r.totalSlots > 0 ? Number((r.usedSlots / r.totalSlots).toFixed(4)) : 0,
    }));

    const stats: Stats = {
      todayBookings,
      weekBookings,
      pendingApproval,
      byStatus,
      benchUsage,
    };

    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
