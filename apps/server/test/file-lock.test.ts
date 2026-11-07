import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquireFileLock } from '../src/file-lock.js';

/** 所有临时目录，afterEach 统一清理（绝不触碰仓库内 data/collab.lock）。 */
let tmpDirs: string[] = [];

function makeTmpLockPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-lock-'));
  tmpDirs.push(dir);
  return path.join(dir, 'collab.lock');
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 忽略清理失败 */
    }
  }
  tmpDirs = [];
});

describe('acquireFileLock', () => {
  it('1. 首次 acquire 成功：锁文件内容为当前 pid，release 删除且幂等', () => {
    const lockPath = makeTmpLockPath();

    const lock = acquireFileLock(lockPath);

    expect(fs.existsSync(lockPath)).toBe(true);
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(String(process.pid));

    lock.release();
    expect(fs.existsSync(lockPath)).toBe(false);

    // release 幂等：重复调用不抛错
    expect(() => lock.release()).not.toThrow();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('2. 锁已存在且持有者存活：第二次 acquire 抛错（另一个服务实例）', () => {
    const lockPath = makeTmpLockPath();
    // 测试内写当前进程 pid，模拟本机另一个存活实例
    fs.writeFileSync(lockPath, String(process.pid));

    let caught: unknown;
    try {
      acquireFileLock(lockPath);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('另一个服务实例');
    // 锁文件不被覆盖
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(String(process.pid));
  });

  it('3. 陈旧锁（pid 不存在）：acquire 接管成功并写入当前 pid', () => {
    const lockPath = makeTmpLockPath();
    fs.writeFileSync(lockPath, '999999');

    const lock = acquireFileLock(lockPath);

    expect(fs.existsSync(lockPath)).toBe(true);
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(String(process.pid));

    lock.release();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('4. EPERM 探测：process.kill 抛 code=EPERM 时视为持有者存活，acquire 抛错', () => {
    const lockPath = makeTmpLockPath();
    // 999999 是不存在的 pid（正常会走 ESRCH → 接管），靠 mock 强制走 EPERM 分支
    fs.writeFileSync(lockPath, '999999');

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      const err = new Error('operation not permitted') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    });

    expect(() => acquireFileLock(lockPath)).toThrow('另一个服务实例');
    // 确实走的是探测分支
    expect(killSpy).toHaveBeenCalledWith(999999, 0);

    killSpy.mockRestore();
    // 锁文件未被覆盖接管
    expect(fs.readFileSync(lockPath, 'utf8')).toBe('999999');
  });
});
