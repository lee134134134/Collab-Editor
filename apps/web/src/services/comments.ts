import type {
  CommentDTO,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '@collab/shared';
import { request } from '@umijs/max';

export type { CommentDTO, CreateCommentRequest, UpdateCommentRequest };

/** 评论列表（GET /api/docs/:docId/comments） */
export async function listComments(
  docId: string,
  options?: { skipErrorHandler?: boolean },
) {
  return request<CommentDTO[]>(`/api/docs/${docId}/comments`, {
    method: 'GET',
    ...(options ?? {}),
  });
}

/** 创建评论（POST /api/docs/:docId/comments） */
export async function createComment(
  docId: string,
  body: CreateCommentRequest,
  options?: { skipErrorHandler?: boolean },
) {
  return request<CommentDTO>(`/api/docs/${docId}/comments`, {
    method: 'POST',
    data: body,
    ...(options ?? {}),
  });
}

/** 更新评论（PATCH /api/comments/:commentId） */
export async function updateComment(
  _docId: string,
  commentId: string,
  body: UpdateCommentRequest,
  options?: { skipErrorHandler?: boolean },
) {
  return request<CommentDTO>(`/api/comments/${commentId}`, {
    method: 'PATCH',
    data: body,
    ...(options ?? {}),
  });
}

/** 删除评论（DELETE /api/comments/:commentId） */
export async function deleteComment(
  _docId: string,
  commentId: string,
  options?: { skipErrorHandler?: boolean },
) {
  return request<void>(`/api/comments/${commentId}`, {
    method: 'DELETE',
    ...(options ?? {}),
  });
}
