import { NextRequest, NextResponse } from 'next/server';
import { projectStore } from '@/lib/project-store';
import { ProjectError } from '@/lib/project';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function guard(request: NextRequest) {
  const url = new URL(request.url);
  // Next.js can normalize request.url to localhost internally. The Host header
  // retains the address the browser actually visited (e.g. 127.0.0.1).
  const host = request.headers.get('host');
  let browserUrl: URL;
  try { browserUrl = new URL(`${url.protocol}//${host || ''}`); }
  catch { throw new ProjectError('잘못된 호스트입니다.', 403); }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(browserUrl.hostname)) throw new ProjectError('로컬 컴퓨터에서만 사용할 수 있습니다.', 403);
  const origin = request.headers.get('origin');
  if ((origin && origin !== browserUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ProjectError('허용되지 않은 요청입니다.', 403);
}
async function body(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ProjectError('JSON 요청이 필요합니다.', 415);
  const raw = await request.text();
  if (raw.length > 16000) throw new ProjectError('입력 데이터가 너무 큽니다.', 413);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ProjectError('입력 형식이 올바르지 않습니다.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProjectError('프로젝트 객체가 필요합니다.');
  return value as Record<string, unknown>;
}
async function handle(request: NextRequest, action: () => unknown | Promise<unknown>) {
  try { guard(request); return NextResponse.json(await action(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[projects] request failed', error);
    return NextResponse.json({ error: '저장소 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
export async function GET(request: NextRequest) { return handle(request, () => ({ projects: projectStore().list(), categories: projectStore().categories() })); }
export async function POST(request: NextRequest) { return handle(request, async () => {
  const project = projectStore().save(await body(request));
  return { project, categories: projectStore().categories() };
}); }
export async function PUT(request: NextRequest) { return handle(request, async () => {
  const value = await body(request);
  if (typeof value.id !== 'string') throw new ProjectError('프로젝트 ID가 필요합니다.');
  const project = projectStore().save(value, value.id);
  return { project, categories: projectStore().categories() };
}); }
export async function PATCH(request: NextRequest) { return handle(request, async () => {
  const value = await body(request);
  if (typeof value.id !== 'string') throw new ProjectError('프로젝트 ID가 필요합니다.');
  if (Object.hasOwn(value, 'categoryId')) {
    if (Object.hasOwn(value, 'favorite')) throw new ProjectError('분류 이동과 즐겨찾기는 각각 변경해주세요.');
    const project = projectStore().moveCategory(value.id, value.categoryId);
    return { project, categories: projectStore().categories() };
  }
  if (typeof value.id !== 'string' || typeof value.favorite !== 'boolean') throw new ProjectError('즐겨찾기 정보를 확인해주세요.');
  return { project: projectStore().favorite(value.id, value.favorite) };
}); }
export async function DELETE(request: NextRequest) { return handle(request, async () => {
  const value = await body(request);
  if (typeof value.id !== 'string') throw new ProjectError('프로젝트 ID가 필요합니다.');
  projectStore().remove(value.id); return { ok: true };
}); }
