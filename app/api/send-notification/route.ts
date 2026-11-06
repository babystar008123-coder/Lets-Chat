import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey || publicKey.length < 60) {
      return NextResponse.json({
        success: true,
        mock: true,
        message: 'Push notification simulated (VAPID key not configured in production)'
      });
    }

    // Dynamic import to prevent build-time evaluation errors
    const webPush = (await import('web-push')).default;
    webPush.setVapidDetails(
      'mailto:admin@lets-chat.app',
      publicKey,
      privateKey
    );

    if (body.subscription) {
      await webPush.sendNotification(
        body.subscription,
        JSON.stringify(body.payload || { title: "Let's Chat", body: "New Message" })
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Notification service ready' });
}
