/**
 * GET /api/roadmap-overrides
 *
 * Returns the current roadmap status overrides from the client.
 * This is called by the roadmap page to sync overrides.
 *
 * POST /api/roadmap-overrides
 *
 * Saves overrides to a local JSON file so they persist across
 * dev server restarts and can be read by Claude to update
 * the source code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const OVERRIDES_FILE = join(process.cwd(), 'docs', 'roadmap-overrides.json');

export async function GET() {
  try {
    const raw = await readFile(OVERRIDES_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: NextRequest) {
  try {
    const overrides = await request.json();
    await writeFile(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
