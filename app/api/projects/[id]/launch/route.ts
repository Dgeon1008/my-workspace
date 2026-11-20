import { NextRequest, NextResponse } from 'next/server';
import { desktopRunner } from '@/lib/desktop-launch';
import { ProjectError } from '@/lib/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

function guard(request: NextRequest) {
  let url: URL;
  try { url = new URL(`http://${request.headers.get('host') || ''}`); }
  catch { throw new ProjectError('잘못된 호스트입니다.', 403); }
  const origin = request.headers.get('origin');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ProjectError('허용되지 않은 요청입니다.', 403);
}
async function body(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ProjectError('JSON 요청이 필요합니다.', 415);
  const text = await request.text();
  if (text.length > 8000) throw new ProjectError('입력 데이터가 너무 큽니다.', 413);
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new ProjectError('입력 형식이 올바르지 않습니다.'); }
}
async function handle(request: NextRequest, context: Context, action: (id: string) => unknown | Promise<unknown>) {
  try {
    guard(request);
    const { id } = await context.params;
    return NextResponse.json(await action(id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[desktop-launch] request failed');
    return NextResponse.json({ error: '실행 기록을 처리하지 못했습니다. 프로그램 창을 확인해주세요.' }, { status: 500 });
  }
}
export async function GET(request: NextRequest, context: Context) {
  return handle(request, context, id => desktopRunner().status(id, request.nextUrl.searchParams.get('details') === '1'));
}
export async function PUT(request: NextRequest, context: Context) {
  return handle(request, context, async id => desktopRunner().configure(id, (await body(request)).file));
}
export async function DELETE(request: NextRequest, context: Context) {
  return handle(request, context, id => desktopRunner().unlink(id));
}
export async function POST(request: NextRequest, context: Context) {
  return handle(request, context, async id => {
    const value = await body(request);
    if (value.action === 'start') return desktopRunner().start(id, value.confirmedVersion);
    if (value.action === 'acknowledgeClosed') return desktopRunner().acknowledgeClosed(id, value.confirmedClosed);
    throw new ProjectError('지원하지 않는 실행 작업입니다.');
  });
}
