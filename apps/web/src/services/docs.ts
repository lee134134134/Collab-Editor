import type { CreateDocRequest, DocMeta, UpdateDocRequest } from '@collab/shared';
import { request } from '@umijs/max';

export type { CreateDocRequest, DocMeta, UpdateDocRequest };

/** 文档列表（GET /api/docs） */
export async function listDocs(options?: { skipErrorHandler?: boolean }) {
  return request<DocMeta[]>('/api/docs', {
    method: 'GET',
    ...(options ?? {}),
  });
}

/** 创建文档（POST /api/docs） */
export async function createDoc(
  body: CreateDocRequest,
  options?: { skipErrorHandler?: boolean },
) {
  return request<DocMeta>('/api/docs', {
    method: 'POST',
    data: body,
    ...(options ?? {}),
  });
}

/** 文档详情（GET /api/docs/:id） */
export async function getDoc(
  id: string,
  options?: { skipErrorHandler?: boolean },
) {
  return request<DocMeta>(`/api/docs/${id}`, {
    method: 'GET',
    ...(options ?? {}),
  });
}

/** 更新文档（PATCH /api/docs/:id） */
export async function updateDoc(
  id: string,
  body: UpdateDocRequest,
  options?: { skipErrorHandler?: boolean },
) {
  return request<DocMeta>(`/api/docs/${id}`, {
    method: 'PATCH',
    data: body,
    ...(options ?? {}),
  });
}

/** 删除文档（DELETE /api/docs/:id） */
export async function deleteDoc(
  id: string,
  options?: { skipErrorHandler?: boolean },
) {
  return request<void>(`/api/docs/${id}`, {
    method: 'DELETE',
    ...(options ?? {}),
  });
}
