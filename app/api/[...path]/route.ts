import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'https://naver-sa-api-gromeet.loca.lt';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname; // /api/xxx
  const url = `${BACKEND_URL}${path}${request.nextUrl.search}`;
  try {
    const res = await fetch(url, {
      headers: { 'bypass-tunnel-reminder': 'true' },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const url = `${BACKEND_URL}${path}`;
  try {
    const body = await request.json();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 });
  }
}
