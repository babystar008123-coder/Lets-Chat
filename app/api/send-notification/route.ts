import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privKey = process.env.VAPID_PRIVATE_KEY;

    // Check if valid keys are present before loading web-push
    if (!pubKey || !privKey || pubKey.length < 60) {
      return NextResponse.json({
        success: true,
        mock: true,
        message: 'Notification simulated: VAPID keys not configured in environment'
      });
    }

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      'mailto:support@lets-chat.app',
      pubKey,
      privKey
    );

    const body = await req.json();
    if (body && body.subscription) {
      await webpush.sendNotification(
        body.subscription,
        JSON.stringify(body.payload || { title: "Let's Chat", body: "New message received" })
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Notification route operational' });
}
