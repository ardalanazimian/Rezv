/** کلیدهای VAPID در env — بدون هر سه، ready=false و هیچ ارسالی نمی‌رود. */
export function pushTransportReady(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function parseWebPushKeys(token: string | null): { p256dh: string; auth: string } | null {
  if (!token) return null;
  try {
    const j = JSON.parse(token) as { p256dh?: string; auth?: string };
    if (j?.p256dh && j?.auth) return { p256dh: j.p256dh, auth: j.auth };
  } catch { /* توکنِ FCM خام */ }
  return null;
}
