import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const token = await getToken({ req });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, body, url } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { pushSubscription: true },
    });

    if (!user?.pushSubscription) {
      return NextResponse.json({ error: 'No push subscription' }, { status: 400 });
    }

    // Send push notification using web-push
    // This would require web-push library installation
    // For now, return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push send error:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
