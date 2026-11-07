import * as fs from 'node:fs';

/**
 * 多实例防护文件锁（单进程单实例为硬约束：内存房间多实例会静默丢更新）。
 *
 * 策略：
 * - 用 O_EXCL（'wx'）独占创建 data/collab.lock，写入当前 pid。
 * - 已存在时读取其中 pid，process.kill(pid, 0) 探测：
 *   - 进程还活着 → 拒绝启动（报错退出）。
 *   - 进程已死（上次异常退出残留）→ 删除并接管覆盖。
 * - 正常退出时释放（close + unlink）。
 */
export interface FileLock {
  release(): void;
}

export function acquireFileLock(lockPath: string): FileLock {
  // 首次尝试独占创建
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return {
      release() {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          /* 已释放或不存在，忽略 */
        }
      },
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw err;
    }
  }

  // 锁已存在：判断持有者是否存活
  let existingPid = 0;
  try {
    existingPid = Number(fs.readFileSync(lockPath, 'utf8').trim());
  } catch {
    existingPid = 0;
  }

  let alive = false;
  if (Number.isInteger(existingPid) && existingPid > 0) {
    try {
      process.kill(existingPid, 0); // 只探测，不真正发信号
      alive = true;
    } catch (e) {
      // ESRCH 表示进程不存在；EPERM 表示存在但无权限，视为存活
      alive = (e as NodeJS.ErrnoException).code === 'EPERM';
    }
  }

  if (alive) {
    throw new Error(
      `检测到另一个服务实例正在运行（pid=${existingPid}），单实例为硬约束，拒绝启动。` +
        `如确认已停止，请手动删除 ${lockPath}。`,
    );
  }

  // 持有者已死：接管覆盖
  fs.unlinkSync(lockPath);
  const fd = fs.openSync(lockPath, 'wx');
  fs.writeSync(fd, String(process.pid));
  fs.closeSync(fd);
  return {
    release() {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* 忽略 */
      }
    },
  };
}
