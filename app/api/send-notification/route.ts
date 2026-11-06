import { NextResponse } from "next/server";
import webpush from "web-push";

// Configure Web Push with your VAPID keys
webpush.setVapidDetails(
  "mailto:support@letschat.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "YOUR_PUBLIC_KEY_HERE",
  process.env.VAPID_PRIVATE_KEY || "YOUR_PRIVATE_KEY_HERE"
);

export async function POST(req: Request) {
  try {
    const { subscription, title, body, senderId } = await req.json();

    if (!subscription) {
      return NextResponse.json({ error: "No subscription provided" }, { status: 400 });
    }

    const payload = JSON.stringify({
      title: title || "Lets Chat New Message!",
      body: body || "You received a new message.",
      senderId: senderId || "unknown",
      url: "/chat"
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending push notification:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
