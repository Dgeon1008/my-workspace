import { ProjectError } from './project.ts';

export type Category = { id: string; name: string; collapsed: boolean; position: number };
export const UNCATEGORIZED = 'uncategorized';
export const categoryOf = (project: { categoryId?: string | null }) => project.categoryId || UNCATEGORIZED;

export function validateCategoryName(value: unknown) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) throw new ProjectError('카테고리 이름을 확인해주세요.');
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 32) throw new ProjectError('카테고리 이름은 1~32자로 입력해주세요.');
  return { name, key: name.toLocaleLowerCase('ko-KR') };
}
