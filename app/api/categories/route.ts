import { NextRequest, NextResponse } from 'next/server';
import { projectStore } from '@/lib/project-store';
import { ProjectError } from '@/lib/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, action: () => unknown | Promise<unknown>) {
  try {
    let url: URL;
    try { url = new URL(`http://${request.headers.get('host') || ''}`); }
    catch { throw new ProjectError('잘못된 호스트입니다.', 403); }
    const origin = request.headers.get('origin');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ProjectError('허용되지 않은 요청입니다.', 403);
    return NextResponse.json(await action(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[categories] request failed');
    return NextResponse.json({ error: '카테고리를 저장하지 못했습니다. 다시 시도해주세요.' }, { status: 500 });
  }
}
async function body(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ProjectError('JSON 요청이 필요합니다.', 415);
  const text = await request.text();
  if (text.length > 4000) throw new ProjectError('입력 데이터가 너무 큽니다.', 413);
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new ProjectError('입력 형식이 올바르지 않습니다.'); }
}
export async function GET(request: NextRequest) { return handle(request, () => ({ categories: projectStore().categories() })); }
export async function POST(request: NextRequest) {
  return handle(request, async () => {
    const category = projectStore().addCategory((await body(request)).name);
    return { category, categories: projectStore().categories() };
  });
}
export async function PATCH(request: NextRequest) {
  return handle(request, async () => {
    const value = await body(request);
    const category = projectStore().setCategoryCollapsed(value.id, value.collapsed);
    return { category, categories: projectStore().categories() };
  });
}
export async function DELETE(request: NextRequest) {
  return handle(request, async () => {
    const value = await body(request);
    const store = projectStore();
    const result = store.removeCategory(value.id);
    return { ...result, categories: store.categories(), modules: store.modules() };
  });
}
