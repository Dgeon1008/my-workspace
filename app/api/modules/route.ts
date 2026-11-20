import { NextRequest, NextResponse } from 'next/server';
import { projectStore } from '@/lib/project-store';
import { ProjectError } from '@/lib/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function guard(request: NextRequest) {
  let browserUrl: URL;
  try { browserUrl = new URL(`http://${request.headers.get('host') || ''}`); }
  catch { throw new ProjectError('잘못된 호스트입니다.', 403); }
  const origin = request.headers.get('origin');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(browserUrl.hostname) || (origin && origin !== browserUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ProjectError('허용되지 않은 요청입니다.', 403);
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

async function handle(request: NextRequest, action: () => unknown | Promise<unknown>) {
  try {
    guard(request);
    return NextResponse.json(await action(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[harness] request failed');
    return NextResponse.json({ error: '프로젝트 메뉴를 저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request, () => ({ modules: projectStore().modules(), categories: projectStore().categories() }));
}

export async function PATCH(request: NextRequest) {
  return handle(request, async () => {
    const value = await body(request);
    return {
      module: projectStore().moveModule(value.id, value.categoryId),
      modules: projectStore().modules(),
      categories: projectStore().categories(),
    };
  });
}

export async function DELETE(request: NextRequest) {
  return handle(request, async () => {
    const value = await body(request);
    projectStore().removeModule(value.id);
    return { modules: projectStore().modules() };
  });
}
