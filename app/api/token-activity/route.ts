import { NextRequest, NextResponse } from 'next/server';
import { ProjectError } from '@/lib/project';
import { accountTokenActivity } from '@/lib/token-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function guard(request: NextRequest) {
  let host: URL;
  try { host = new URL(`http://${request.headers.get('host') || ''}`); }
  catch { throw new ProjectError('잘못된 호스트입니다.', 403); }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) throw new ProjectError('로컬 컴퓨터에서만 사용할 수 있습니다.', 403);
  const origin = request.headers.get('origin');
  if ((origin && origin !== host.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ProjectError('허용되지 않은 요청입니다.', 403);
}

export async function GET(request: NextRequest) {
  try {
    guard(request);
    return NextResponse.json(await accountTokenActivity(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[token-activity] storage unavailable');
    return NextResponse.json({ error: '토큰 기록 저장소에 접근하지 못했습니다.' }, { status: 500 });
  }
}

