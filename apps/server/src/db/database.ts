import * as fs from 'node:fs';
import * as path from 'node:path';
import { USER_COLORS } from '@collab/shared';
import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import type { AppConfig } from '../config.js';
import { CONFIG } from '../config.js';

/** 与建表 DDL 严格对齐的表行类型，禁止 any（读取结果全部显式声明）。 */
export interface UserRow {
  id: number;
  username: string;
  password_hash: string | null;
  display_name: string;
  color: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  y_state: Buffer | null;
  y_state_vector: Buffer | null;
}

export interface CommentRow {
  id: string;
  doc_id: string;
  author_id: number;
  content: string;
  anchor: string | null;
  parent_id: string | null;
  resolved: number;
  created_at: string;
  updated_at: string;
}

/**
 * 打开数据库：创建目录 → 打开连接 → WAL → 建表 → 种子。
 * better-sqlite3@13 自带 N-API prebuilds（prebuilds/*.node 随包分发），直接 require 即可，
 * 不触发 node-gyp 本地构建。
 */
export function openDatabase(config: AppConfig): Database.Database {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seed(db, config.adminUsername, config.adminPassword);
  return db;
}

/** 幂等建表：启动时 CREATE TABLE IF NOT EXISTS。 */
function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      display_name TEXT,
      color TEXT
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '未命名文档',
      owner_id INTEGER NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      y_state BLOB,
      y_state_vector BLOB
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      anchor TEXT NULL,
      parent_id TEXT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);
}

/** 种子用户：admin（可用 env 覆盖）+ alice + bob；color 依次取 @collab/shared 的 USER_COLORS。 */
function seed(
  db: Database.Database,
  adminUsername: string,
  adminPassword: string,
): void {
  const seeds = [
    {
      username: adminUsername,
      password: adminPassword,
      display_name: '管理员',
    },
    { username: 'alice', password: 'alice123', display_name: 'Alice' },
    { username: 'bob', password: 'bob123', display_name: 'Bob' },
  ];
  const exists = db.prepare<[string], { id: number }>(
    'SELECT id FROM users WHERE username = ?',
  );
  const insert = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, color) VALUES (?, ?, ?, ?)',
  );
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    if (!exists.get(s.username)) {
      insert.run(
        s.username,
        bcrypt.hashSync(s.password, 10),
        s.display_name,
        USER_COLORS[i % USER_COLORS.length],
      );
    }
  }
}

/**
 * 数据库连接封装：作为全局 provider，供 docs/comments/collab 各模块注入；
 * 进程退出时经 Nest 生命周期关闭连接。
 */
@Injectable()
export class DbService {
  readonly db: Database.Database;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.db = openDatabase(config);
  }

  onModuleDestroy(): void {
    this.db.close();
  }
}
