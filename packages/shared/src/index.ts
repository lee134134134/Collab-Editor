export interface UserDTO {
  id: number;
  username: string;
  displayName: string;
  color: string;
}
export interface LoginRequest {
  username: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  user: UserDTO;
}
export interface DocMeta {
  id: string;
  title: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateDocRequest {
  title?: string;
}
export interface UpdateDocRequest {
  title?: string;
}
export interface CommentAnchor {
  start: string;
  end: string;
  quote: string;
}
export interface CommentDTO {
  id: string;
  docId: string;
  author: UserDTO;
  content: string;
  anchor: CommentAnchor | null;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CreateCommentRequest {
  content: string;
  anchor?: CommentAnchor;
  parentId?: string | null;
}
export interface UpdateCommentRequest {
  content?: string;
  resolved?: boolean;
}
export const USER_COLORS = [
  '#f0883e',
  '#1f7ae0',
  '#10b39c',
  '#8f6ee8',
  '#e0488a',
  '#c2761a',
] as const;
export const WS_MSG_COMMENT_ACTIVITY = 100;
export interface CommentActivityEvent {
  type: 'created' | 'updated' | 'deleted';
  commentId: string;
  docId: string;
}
/** 协同连接状态 */
export type CollabStatus = 'connected' | 'connecting' | 'disconnected';
/** 远端在线用户信息（来自 y-websocket awareness） */
export interface PresenceUser {
  clientId: number;
  name: string;
  color: string;
}
/** 评论线程树结构（顶层评论 + 回复列表） */
export interface CommentThread extends CommentDTO {
  replies: CommentDTO[];
}
