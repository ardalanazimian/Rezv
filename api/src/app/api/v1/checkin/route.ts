import { NextResponse } from 'next/server';
import { qrCheckIn } from '@/lib/tables';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

const schema = z.object({ qr_code: z.string().min(1).max(200) });

/** POST /api/v1/checkin — مهمان با اسکن QR میز check-in می‌کند. بدنه: { qr_code } */
export async function POST(req: Request) {
  try {
    const { qr_code } = await parseBody(req, schema);
    const result = await qrCheckIn(qr_code);
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
