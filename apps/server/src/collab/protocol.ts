/**
 * y-websocket 协议常量（与客户端 y-websocket@3.1.0 完全对齐，lib0 varint 编码，非 protobuf）。
 */
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_AUTH = 2;
export const MESSAGE_QUERY_AWARENESS = 3;

/**
 * 鉴权失败关闭码 4401：y-websocket 客户端把 4400–4499 视为永久失败（不再自动重连）。
 */
export const CLOSE_UNAUTHORIZED = 4401;
/** 正常关闭码（文档删除时逐出全部连接）。 */
export const CLOSE_NORMAL = 1000;
/** 服务停机时关闭连接所用码。 */
export const CLOSE_GOING_AWAY = 1001;

/** 心跳 ping 间隔（y-websocket 参考实现为 30s）。 */
export const PING_INTERVAL_MS = 30_000;

/**
 * 评论 Mark 在 Yjs 文本节点上的格式属性名（契约：与前端 Tiptap 评论扩展一致）。
 * Mark 属性结构：{ commentId: string, resolved: boolean }。
 */
export const COMMENT_MARK_NAME = 'comment';

/** 房间空闲后延迟逐出时长（期间新连接复用内存 ydoc 并取消逐出）。 */
export const EVICT_DELAY_MS = 30_000;
