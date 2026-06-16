import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'lab_booking.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','tutor','admin','safety')),
    department TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS benches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    location TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','disabled')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bench_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','booked','occupied','maintenance')),
    booking_id INTEGER,
    FOREIGN KEY (bench_id) REFERENCES benches(id)
);
CREATE INDEX IF NOT EXISTS idx_slots_bench_date ON time_slots(bench_id, date);

CREATE TABLE IF NOT EXISTS cycle_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bench_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    weekdays TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (bench_id) REFERENCES benches(id)
);

CREATE TABLE IF NOT EXISTS approval_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    condition_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS approval_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (route_id) REFERENCES approval_routes(id)
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bench_id INTEGER NOT NULL,
    applicant_id INTEGER NOT NULL,
    tutor_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    current_node_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (bench_id) REFERENCES benches(id),
    FOREIGN KEY (applicant_id) REFERENCES users(id),
    FOREIGN KEY (tutor_id) REFERENCES users(id),
    FOREIGN KEY (route_id) REFERENCES approval_routes(id)
);

CREATE TABLE IF NOT EXISTS booking_slots (
    booking_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL,
    PRIMARY KEY (booking_id, slot_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (slot_id) REFERENCES time_slots(id)
);

CREATE TABLE IF NOT EXISTS approval_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    node_index INTEGER NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('approve','reject')),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (approver_id) REFERENCES users(id)
);
`;

db.exec(SCHEMA_SQL);

const seedUsers = db.prepare("SELECT COUNT(*) as c FROM users").get() as any;
if (seedUsers.c === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (name, account, password_hash, role, department) VALUES (?, ?, ?, ?, ?)'
  );
  const users = [
    ['张同学', 'stu001', '123456', 'student', '化学学院'],
    ['李同学', 'stu002', '123456', 'student', '物理学院'],
    ['王导师', 'tut001', '123456', 'tutor', '化学学院'],
    ['赵导师', 'tut002', '123456', 'tutor', '物理学院'],
    ['陈管理员', 'adm001', '123456', 'admin', '实验中心'],
    ['刘安全员', 'saf001', '123456', 'safety', '安全办公室'],
  ];
  const insertMany = db.transaction((list: any[]) => {
    for (const row of list) insertUser.run(...row);
  });
  insertMany(users);

  const insertBench = db.prepare(
    'INSERT INTO benches (name, code, location, risk_level, description, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const benches = [
    ['化学实验台A-01', 'CHEM-A01', '化学楼301-A', 'low', '基础化学实验台，配备常用玻璃仪器', 'active'],
    ['化学实验台B-02', 'CHEM-B02', '化学楼301-B', 'medium', '有机化学实验台，配备通风橱', 'active'],
    ['物理实验台P-01', 'PHY-P01', '物理楼201', 'low', '普通物理实验台，配备光学仪器', 'active'],
    ['生物安全台S-01', 'BIO-S01', '生物楼101', 'high', '生物安全二级实验台，配备生物安全柜', 'active'],
    ['材料实验台M-01', 'MAT-M01', '材料楼401', 'medium', '材料合成实验台，配备高温炉', 'active'],
  ];
  const insertBenches = db.transaction((list: any[]) => {
    for (const row of list) insertBench.run(...row);
  });
  insertBenches(benches);

  const insertRoute = db.prepare('INSERT INTO approval_routes (name, condition_json, status) VALUES (?, ?, ?)');
  const routes = [
    ['低危实验审批流程', JSON.stringify({ field: 'riskLevel', op: '==', value: 'low' }), 'active'],
    ['中危实验审批流程', JSON.stringify({ field: 'riskLevel', op: '==', value: 'medium' }), 'active'],
    ['高危实验审批流程', JSON.stringify({ field: 'riskLevel', op: '==', value: 'high' }), 'active'],
  ];
  const insertRoutes = db.transaction((list: any[]) => {
    for (const row of list) insertRoute.run(...row);
  });
  insertRoutes(routes);

  const insertNode = db.prepare('INSERT INTO approval_nodes (route_id, name, role, order_index) VALUES (?, ?, ?, ?)');
  const nodes = [
    [1, '导师审批', 'tutor', 1],
    [2, '导师审批', 'tutor', 1],
    [2, '实验室管理员审批', 'admin', 2],
    [3, '导师审批', 'tutor', 1],
    [3, '安全审批员审批', 'safety', 2],
    [3, '实验室管理员审批', 'admin', 3],
  ];
  const insertNodes = db.transaction((list: any[]) => {
    for (const row of list) insertNode.run(...row);
  });
  insertNodes(nodes);

  console.log('[DB] 初始化数据已插入');
}

export default db;
