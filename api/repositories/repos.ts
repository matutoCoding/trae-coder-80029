import db from '../database.js';
import type {
  User,
  Bench,
  TimeSlot,
  CycleRule,
  ApprovalRoute,
  ApprovalNode,
  Booking,
  ApprovalRecord,
} from '../../shared/types.js';

function camel<T = any>(row: any): T {
  if (!row) return row as T;
  const out: any = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = row[key];
  }
  return out as T;
}

function camelArr<T = any>(rows: any[]): T[] {
  return rows.map((r) => camel<T>(r));
}

export const userRepo = {
  findAll(): User[] {
    return camelArr<User>(db.prepare('SELECT * FROM users ORDER BY id').all());
  },
  findByRole(role: string): User[] {
    return camelArr<User>(db.prepare('SELECT * FROM users WHERE role = ? ORDER BY name').all(role));
  },
  findById(id: number): User | undefined {
    return camel<User>(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  },
};

export const benchRepo = {
  findAll(filters?: { riskLevel?: string; status?: string; keyword?: string }): Bench[] {
    let sql = 'SELECT * FROM benches WHERE 1=1';
    const params: any[] = [];
    if (filters?.riskLevel) {
      sql += ' AND risk_level = ?';
      params.push(filters.riskLevel);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.keyword) {
      sql += ' AND (name LIKE ? OR code LIKE ? OR location LIKE ?)';
      const kw = `%${filters.keyword}%`;
      params.push(kw, kw, kw);
    }
    sql += ' ORDER BY id';
    return camelArr<Bench>(db.prepare(sql).all(...params));
  },
  findById(id: number): Bench | undefined {
    return camel<Bench>(db.prepare('SELECT * FROM benches WHERE id = ?').get(id));
  },
  create(data: Omit<Bench, 'id' | 'createdAt'>): number {
    const info = db
      .prepare(
        'INSERT INTO benches (name, code, location, risk_level, description, status) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(data.name, data.code, data.location, data.riskLevel, data.description, data.status);
    return Number(info.lastInsertRowid);
  },
  update(id: number, data: Partial<Omit<Bench, 'id' | 'createdAt'>>): void {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.code !== undefined) { sets.push('code = ?'); params.push(data.code); }
    if (data.location !== undefined) { sets.push('location = ?'); params.push(data.location); }
    if (data.riskLevel !== undefined) { sets.push('risk_level = ?'); params.push(data.riskLevel); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    params.push(id);
    db.prepare(`UPDATE benches SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  },
  remove(id: number): void {
    db.prepare('DELETE FROM benches WHERE id = ?').run(id);
  },
};

export const slotRepo = {
  findByBenchAndRange(benchId: number, startDate: string, endDate: string): TimeSlot[] {
    return camelArr<TimeSlot>(
      db
        .prepare('SELECT * FROM time_slots WHERE bench_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_time')
        .all(benchId, startDate, endDate)
    );
  },
  findByIds(ids: number[]): TimeSlot[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return camelArr<TimeSlot>(
      db.prepare(`SELECT * FROM time_slots WHERE id IN (${placeholders}) ORDER BY date, start_time`).all(...ids)
    );
  },
  upsertMany(items: Omit<TimeSlot, 'id'>[]): number {
    const stmt = db.prepare(
      `INSERT INTO time_slots (bench_id, date, start_time, end_time, status, booking_id)
       VALUES (@benchId, @date, @startTime, @endTime, @status, @bookingId)
       ON CONFLICT DO NOTHING`
    );
    const run = db.transaction((list: any[]) => {
      let count = 0;
      for (const it of list) {
        const info = stmt.run({
          benchId: it.benchId,
          date: it.date,
          startTime: it.startTime,
          endTime: it.endTime,
          status: it.status ?? 'available',
          bookingId: it.bookingId ?? null,
        });
        count += Number(info.changes);
      }
      return count;
    });
    return run(items);
  },
  update(id: number, data: Partial<Omit<TimeSlot, 'id'>>): void {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.date !== undefined) { sets.push('date = ?'); params.push(data.date); }
    if (data.startTime !== undefined) { sets.push('start_time = ?'); params.push(data.startTime); }
    if (data.endTime !== undefined) { sets.push('end_time = ?'); params.push(data.endTime); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    if (data.bookingId !== undefined) { sets.push('booking_id = ?'); params.push(data.bookingId); }
    params.push(id);
    db.prepare(`UPDATE time_slots SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  },
  setBookingForSlots(slotIds: number[], bookingId: number | null): void {
    if (slotIds.length === 0) return;
    const status = bookingId ? 'booked' : 'available';
    const placeholders = slotIds.map(() => '?').join(',');
    db.prepare(`UPDATE time_slots SET status = '${status}', booking_id = ? WHERE id IN (${placeholders})`).run(
      bookingId,
      ...slotIds
    );
  },
  bulkUpdateStatus(slotIds: number[], status: string): void {
    if (slotIds.length === 0) return;
    const placeholders = slotIds.map(() => '?').join(',');
    db.prepare(`UPDATE time_slots SET status = ? WHERE id IN (${placeholders})`).run(status, ...slotIds);
  },
};

export const cycleRuleRepo = {
  findAll(): CycleRule[] {
    const rows = db.prepare('SELECT * FROM cycle_rules ORDER BY id DESC').all();
    return rows.map((r: any) => ({
      ...camel<CycleRule>(r),
      weekdays: JSON.parse(r.weekdays),
    }));
  },
  findById(id: number): CycleRule | undefined {
    const row = db.prepare('SELECT * FROM cycle_rules WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return { ...camel<CycleRule>(row), weekdays: JSON.parse(row.weekdays) };
  },
  create(data: Omit<CycleRule, 'id'>): number {
    const info = db
      .prepare(
        `INSERT INTO cycle_rules (bench_id, name, weekdays, start_time, end_time, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.benchId,
        data.name,
        JSON.stringify(data.weekdays),
        data.startTime,
        data.endTime,
        data.startDate,
        data.endDate,
        data.status
      );
    return Number(info.lastInsertRowid);
  },
  remove(id: number): void {
    db.prepare('DELETE FROM cycle_rules WHERE id = ?').run(id);
  },
};

export const routeRepo = {
  findAll(): ApprovalRoute[] {
    const routes = camelArr<any>(db.prepare('SELECT * FROM approval_routes ORDER BY id').all());
    const nodes = camelArr<ApprovalNode>(
      db.prepare('SELECT * FROM approval_nodes ORDER BY route_id, order_index').all()
    );
    return routes.map((r) => ({
      ...r,
      condition: typeof r.conditionJson === 'string' ? JSON.parse(r.conditionJson) : r.conditionJson,
      nodes: nodes.filter((n) => n.routeId === r.id),
    }));
  },
  findActiveRoutes(): ApprovalRoute[] {
    return this.findAll().filter((r) => r.status === 'active');
  },
  findById(id: number): ApprovalRoute | undefined {
    return this.findAll().find((r) => r.id === id);
  },
  create(data: Omit<ApprovalRoute, 'id' | 'nodes'> & { nodes: Omit<ApprovalNode, 'id' | 'routeId'>[] }): number {
    const run = db.transaction(() => {
      const info = db
        .prepare('INSERT INTO approval_routes (name, condition_json, status) VALUES (?, ?, ?)')
        .run(data.name, JSON.stringify(data.condition), data.status);
      const routeId = Number(info.lastInsertRowid);
      const stmt = db.prepare(
        'INSERT INTO approval_nodes (route_id, name, role, order_index) VALUES (?, ?, ?, ?)'
      );
      for (const n of data.nodes) {
        stmt.run(routeId, n.name, n.role, n.orderIndex);
      }
      return routeId;
    });
    return run();
  },
  update(
    id: number,
    data: Partial<Omit<ApprovalRoute, 'id' | 'nodes'>> & { nodes?: Omit<ApprovalNode, 'id' | 'routeId'>[] }
  ): void {
    const run = db.transaction(() => {
      const sets: string[] = [];
      const params: any[] = [];
      if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
      if (data.condition !== undefined) { sets.push('condition_json = ?'); params.push(JSON.stringify(data.condition)); }
      if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
      if (sets.length > 0) {
        params.push(id);
        db.prepare(`UPDATE approval_routes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }
      if (data.nodes) {
        db.prepare('DELETE FROM approval_nodes WHERE route_id = ?').run(id);
        const stmt = db.prepare(
          'INSERT INTO approval_nodes (route_id, name, role, order_index) VALUES (?, ?, ?, ?)'
        );
        for (const n of data.nodes) {
          stmt.run(id, n.name, n.role, n.orderIndex);
        }
      }
    });
    run();
  },
  remove(id: number): void {
    const run = db.transaction(() => {
      db.prepare('DELETE FROM approval_nodes WHERE route_id = ?').run(id);
      db.prepare('DELETE FROM approval_routes WHERE id = ?').run(id);
    });
    run();
  },
};

export const bookingRepo = {
  findByApplicant(applicantId: number): Booking[] {
    const rows = camelArr<any>(
      db.prepare('SELECT * FROM bookings WHERE applicant_id = ? ORDER BY created_at DESC').all(applicantId)
    );
    return rows.map((r) => this._hydrate(r));
  },
  findByApproverRole(userId: number, role: string): Booking[] {
    const all = camelArr<any>(db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all());
    return all
      .map((r) => this._hydrate(r))
      .filter((b) => {
        const route = routeRepo.findById(b.routeId);
        if (!route) return false;
        const currentNode = route.nodes.find((n) => n.orderIndex === b.currentNodeIndex + 1);
        if (!currentNode) return false;
        if (currentNode.role !== role) return false;
        const user = userRepo.findById(userId);
        if (!user) return false;
        if (role === 'tutor') return b.tutorId === userId;
        return true;
      });
  },
  findAll(): Booking[] {
    const rows = camelArr<any>(db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all());
    return rows.map((r) => this._hydrate(r));
  },
  findById(id: number): Booking | undefined {
    const row = camel<any>(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
    if (!row) return undefined;
    return this._hydrate(row);
  },
  _hydrate(row: any): Booking {
    const slotIds = db
      .prepare('SELECT slot_id FROM booking_slots WHERE booking_id = ?')
      .all(row.id)
      .map((r: any) => r.slot_id);
    return {
      ...row,
      slotIds,
    };
  },
  create(data: Omit<Booking, 'id' | 'createdAt' | 'slotIds'> & { slotIds: number[] }): number {
    const run = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO bookings (bench_id, applicant_id, tutor_id, route_id, title, risk_level, status, current_node_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.benchId,
          data.applicantId,
          data.tutorId,
          data.routeId,
          data.title,
          data.riskLevel,
          data.status,
          data.currentNodeIndex
        );
      const bookingId = Number(info.lastInsertRowid);
      const stmt = db.prepare('INSERT INTO booking_slots (booking_id, slot_id) VALUES (?, ?)');
      for (const sid of data.slotIds) stmt.run(bookingId, sid);
      slotRepo.setBookingForSlots(data.slotIds, bookingId);
      return bookingId;
    });
    return run();
  },
  updateStatus(id: number, status: string, currentNodeIndex: number): void {
    db.prepare('UPDATE bookings SET status = ?, current_node_index = ? WHERE id = ?').run(
      status,
      currentNodeIndex,
      id
    );
  },
  cancel(id: number): void {
    const booking = this.findById(id);
    if (!booking) return;
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', id);
    slotRepo.setBookingForSlots(booking.slotIds, null);
  },
  findByApprover(approverId: number): Booking[] {
    const recordRows = db
      .prepare('SELECT DISTINCT booking_id FROM approval_records WHERE approver_id = ? ORDER BY created_at DESC')
      .all(approverId);
    const ids = recordRows.map((r: any) => r.booking_id);
    return ids
      .map((id: number) => this.findById(id))
      .filter((b): b is Booking => b !== undefined);
  },
};

export const recordRepo = {
  findByBooking(bookingId: number): ApprovalRecord[] {
    const rows = db
      .prepare(
        `SELECT ar.*, u.name as approver_name FROM approval_records ar
         LEFT JOIN users u ON u.id = ar.approver_id
         WHERE ar.booking_id = ? ORDER BY ar.created_at`
      )
      .all(bookingId);
    return camelArr<ApprovalRecord>(rows);
  },
  create(data: Omit<ApprovalRecord, 'id' | 'createdAt'>): number {
    const info = db
      .prepare(
        'INSERT INTO approval_records (booking_id, approver_id, node_index, action, comment) VALUES (?, ?, ?, ?, ?)'
      )
      .run(data.bookingId, data.approverId, data.nodeIndex, data.action, data.comment || '');
    return Number(info.lastInsertRowid);
  },
};
