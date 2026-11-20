export const statuses = ['진행 중', '계획 중', '완료'] as const;
export const colors = ['sage', 'blue', 'violet', 'amber', 'rose'] as const;
export type ProjectStatus = typeof statuses[number];
export type ProjectColor = typeof colors[number];
export type ProjectInput = { name: string; path: string; description: string; tags: string[]; status: ProjectStatus; color: ProjectColor; favorite: boolean; categoryId?: string | null };
export type Project = ProjectInput & { id: string; createdAt: string; updatedAt: string };

export class ProjectError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function validateProject(value: unknown): ProjectInput {
  if (!value || typeof value !== 'object') throw new ProjectError('프로젝트 정보를 확인해주세요.');
  const p = value as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 80) throw new ProjectError('프로젝트 이름은 1~80자로 입력해주세요.');
  if (typeof p.path !== 'string' || !p.path.trim() || p.path.length > 2048 || p.path.includes('\0')) throw new ProjectError('올바른 폴더 경로를 입력해주세요.');
  if (typeof p.description !== 'string' || p.description.length > 500) throw new ProjectError('설명은 500자 이내로 입력해주세요.');
  if (!Array.isArray(p.tags) || p.tags.length > 8 || p.tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 24)) throw new ProjectError('태그는 24자 이내, 최대 8개까지 등록할 수 있습니다.');
  if (!statuses.includes(p.status as ProjectStatus) || !colors.includes(p.color as ProjectColor) || typeof p.favorite !== 'boolean') throw new ProjectError('상태와 색상 정보를 확인해주세요.');
  if (p.categoryId !== undefined && p.categoryId !== null && (typeof p.categoryId !== 'string' || !p.categoryId || p.categoryId.length > 80)) throw new ProjectError('카테고리를 확인해주세요.');
  return { name: p.name.trim(), path: p.path.trim(), description: p.description.trim(), tags: [...new Set((p.tags as string[]).map(t => t.trim()))], status: p.status as ProjectStatus, color: p.color as ProjectColor, favorite: p.favorite, ...(p.categoryId !== undefined ? { categoryId: p.categoryId as string | null } : {}) };
}
