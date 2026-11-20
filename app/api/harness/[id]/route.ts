import { NextRequest, NextResponse } from 'next/server';
import { ensureHarnessProject } from '@/lib/harness-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  let host: URL;
  try { host = new URL(`http://${request.headers.get('host') || ''}`); }
  catch { return NextResponse.json({ error: '잘못된 호스트입니다.' }, { status: 403 }); }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) || (origin && origin !== host.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  }
  const { id } = await context.params;
  // Only explicitly configured web projects can be started. Trading processes
  // and user-provided commands/paths are never accepted by this endpoint.
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  try {
    return NextResponse.json({ url: await ensureHarnessProject(id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[harness] project connection failed', id);
    return NextResponse.json({ error: error instanceof Error ? error.message : '프로젝트에 연결하지 못했습니다.' }, { status: 503 });
  }
}
