/**
 * 单文档串行持久化队列（oracle 硬约束 #1 的落库收口）。
 *
 * 约束落实：
 * - 只写全量：快照 = encodeStateAsUpdate(ydoc)（绝不带 stateVector 做差量覆盖）+ encodeStateVector(ydoc)，
 *   二者在同一事务 UPDATE documents（顺带 updated_at）。
 * - 每文档单一串行 writer：模块内 promise 链串行化所有写入。
 * - 5s 防抖 + 活跃期 30s 兜底 + 最终 flush（逐出/SIGINT/SIGTERM 时 flushNow）。
 * - 不在 ws close 回调里同步 flush 大文档：一律进队列，由定时器/显式 flush 触发。
 */
export interface Snapshot {
  update: Uint8Array;
  vector: Uint8Array;
}

export class PersistenceQueue {
  private dirty = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private chain: Promise<void> = Promise.resolve();
  private destroyed = false;

  constructor(
    /** 同步捕获当前权威 ydoc 的全量快照（update + vector 必须原子取自同一状态） */
    private readonly getSnapshot: () => Snapshot,
    /** 把快照写入 SQLite（调用方保证单事务） */
    private readonly writeSnapshot: (snapshot: Snapshot) => void,
    private readonly debounceMs = 5_000,
    private readonly fallbackMs = 30_000,
  ) {}

  /** 标记脏数据：5s 防抖后落库；活跃期最迟 30s 兜底落一次。 */
  markDirty(): void {
    if (this.destroyed) return;
    this.dirty = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flush(), this.debounceMs);
    if (!this.fallbackTimer) {
      this.fallbackTimer = setInterval(() => {
        if (this.dirty) this.flush();
      }, this.fallbackMs);
    }
  }

  /** 若脏则落库（快照在进入串行链前同步捕获，保证 update+vector 原子且不依赖 ydoc 存活）。 */
  flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (!this.dirty || this.destroyed) return;
    this.dirty = false;
    this.enqueue(this.getSnapshot());
  }

  /** 最终落库：无条件写一次当前全量（逐出/停机时调用），返回该次写入完成的 promise。 */
  flushNow(): Promise<void> {
    if (this.destroyed) return this.chain;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.dirty = false;
    this.enqueue(this.getSnapshot());
    return this.chain;
  }

  private enqueue(snapshot: Snapshot): void {
    this.chain = this.chain
      .then(() => this.writeSnapshot(snapshot))
      .catch((err) => {
        // 落库失败不阻断后续写入，仅告警（demo 量级可接受）
        console.error('[PersistenceQueue] 落库失败', err);
      });
  }

  /** 销毁队列：停止定时器并拒绝后续写入（已入链的快照仍会写出）。 */
  destroy(): void {
    this.destroyed = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
  }
}
