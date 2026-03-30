/**
 * POST /api/feedback-email — Send user feedback directly to our inbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const body = await request.json();
  const { message, page } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: 'boredgame.lol Feedback <feedback@boredgame.lol>',
      to: 'danjwiegand@gmail.com',
      subject: `Feedback: ${message.trim().slice(0, 60)}`,
      text: `${message.trim()}\n\n---\nPage: ${page ?? 'unknown'}\nTime: ${new Date().toISOString()}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Feedback] Send error:', err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
