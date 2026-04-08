/**
 * GET /api/blog/generate — Generate a blog post draft via the full pipeline
 *
 * Called by Vercel Cron Job (2x daily, slot=0 at 6 AM, slot=1 at 6 PM UTC).
 * Protected by CRON_SECRET. Runs the 8-stage pipeline: topic pick, game fetch,
 * recent posts query, LLM generation, fact-check, edit, image processing,
 * quality evaluation. Posts are saved as drafts and emailed for approval.
 * Each run is tracked in blog_pipeline_runs for monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { runBlogPipeline } from '@/lib/blog/pipeline';

// Allow up to 300s for the full pipeline (requires Vercel Pro)
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic not configured' }, { status: 503 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const slot = parseInt(request.nextUrl.searchParams.get('slot') ?? '0', 10);
  const startTime = Date.now();

  console.log(`[Blog Generate] Cron hit at ${new Date().toISOString()} (slot: ${slot})`);

  // Track pipeline run
  const { data: run } = await supabase
    .from('blog_pipeline_runs')
    .insert({ slot, status: 'running' })
    .select('id')
    .single();
  const runId = run?.id;

  try {
    // Run the full pipeline
    const result = await runBlogPipeline(supabase, openai, anthropic, slot);

    const slug = slugify(result.title) + `-${Date.now().toString(36)}`;

    // Auto-reject if quality is too low
    const status = result.qualityReport.passed ? 'draft' : 'rejected';

    // Store post
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title: result.title,
        description: result.description,
        content: result.content,
        tags: result.tags ?? [],
        featured_game_ids: result.featuredGameIds,
        published_at: null,
        status,
      })
      .select()
      .single();

    if (error) {
      console.error('[Blog Generate] DB error:', error);
      if (runId) {
        await supabase.from('blog_pipeline_runs').update({
          status: 'error',
          error_message: `DB save failed: ${error.message}`,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          topic_hint: result.title,
          quality_score: result.qualityReport.average,
        }).eq('id', runId);
      }
      return NextResponse.json({ error: 'Failed to save post' }, { status: 500 });
    }

    // Email draft for approval (skip if auto-rejected)
    // Isolated try/catch so email failures don't mask a successful pipeline run
    let emailSent = false;
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && post.approval_token && status === 'draft') {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://boredgame.lol';
        const approveUrl = `${baseUrl}/api/blog/approve?token=${post.approval_token}`;
        const rejectUrl = `${baseUrl}/api/blog/approve?token=${post.approval_token}&action=reject`;
        const previewUrl = `${baseUrl}/api/blog/preview?token=${post.approval_token}`;

        const q = result.qualityReport;
        const qualityColor = q.average >= 7 ? '#4caf50' : q.average >= 5 ? '#ff9800' : '#f44336';
        const correctionsList = result.corrections.length > 0
          ? result.corrections.map((c) => `<li><strong>${c.game}</strong>: ${c.field} was "${c.claimed}", corrected to "${c.actual}"</li>`).join('')
          : '<li>None</li>';
        const editsList = result.edits.length > 0
          ? result.edits.map((e) => `<li>${e}</li>`).join('')
          : '<li>None</li>';

        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'boredgame.lol Blog <blog@boredgame.lol>',
          to: 'contact@boredgame.lol',
          subject: `Blog Draft: ${result.title} (${q.average}/10)`,
          html: `
            <h2>New Blog Draft Ready for Review</h2>
            <h3>${result.title}</h3>
            <p><em>${result.description}</em></p>

            <div style="background:${qualityColor};color:white;padding:12px 20px;border-radius:8px;display:inline-block;font-size:18px;font-weight:bold;margin:12px 0;">
              Quality Score: ${q.average}/10
            </div>

            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px;">Accuracy</td><td style="padding:4px 12px;font-weight:bold;">${q.scores.accuracy}/10</td></tr>
              <tr><td style="padding:4px 12px;">Readability</td><td style="padding:4px 12px;font-weight:bold;">${q.scores.readability}/10</td></tr>
              <tr><td style="padding:4px 12px;">Tone</td><td style="padding:4px 12px;font-weight:bold;">${q.scores.tone}/10</td></tr>
              <tr><td style="padding:4px 12px;">SEO</td><td style="padding:4px 12px;font-weight:bold;">${q.scores.seo}/10</td></tr>
              <tr><td style="padding:4px 12px;">Completeness</td><td style="padding:4px 12px;font-weight:bold;">${q.scores.completeness}/10</td></tr>
            </table>

            ${q.feedback ? `<p><strong>Feedback:</strong> ${q.feedback}</p>` : ''}

            <details style="margin:12px 0;">
              <summary style="cursor:pointer;font-weight:bold;">Fact-Check Corrections (${result.corrections.length})</summary>
              <ul>${correctionsList}</ul>
            </details>

            <details style="margin:12px 0;">
              <summary style="cursor:pointer;font-weight:bold;">Edits Applied (${result.edits.length})</summary>
              <ul>${editsList}</ul>
            </details>

            ${result.imageErrors.length > 0 ? `<p style="color:#f44336;"><strong>Image Errors:</strong> ${result.imageErrors.join(', ')}</p>` : ''}

            <p><strong>Tags:</strong> ${(result.tags ?? []).join(', ')}</p>
            <p><strong>Featured games:</strong> ${result.featuredGameIds.length} games linked</p>

            <hr />
            <p><a href="${previewUrl}" style="color:#2196f3;font-size:16px;">Preview full post</a></p>
            <br />
            <p>
              <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#4caf50;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Approve and Publish</a>
              &nbsp;&nbsp;
              <a href="${rejectUrl}" style="display:inline-block;padding:12px 24px;background:#f44336;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Reject</a>
            </p>
          `,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('[Blog Generate] Email send failed:', emailErr);
      }
    }

    // Update pipeline run tracking
    if (runId) {
      await supabase.from('blog_pipeline_runs').update({
        status: 'success',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        topic_hint: result.title,
        games_fetched: result.featuredGameIds.length,
        quality_score: result.qualityReport.average,
        corrections: result.corrections.length,
        edits: result.edits.length,
        post_slug: post.slug,
        post_status: status,
        email_sent: emailSent,
      }).eq('id', runId);
    }

    console.log(`[Blog Generate] Done: "${result.title}" (${status}, quality: ${result.qualityReport.average}/10, email: ${emailSent}, ${Date.now() - startTime}ms)`);

    return NextResponse.json({
      success: true,
      slug: post.slug,
      title: result.title,
      status,
      quality: result.qualityReport.average,
      corrections: result.corrections.length,
      edits: result.edits.length,
      emailSent,
    });
  } catch (err) {
    console.error('[Blog Generate] Pipeline error:', err);

    // Track the failure
    if (runId) {
      await supabase.from('blog_pipeline_runs').update({
        status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      }).eq('id', runId);
    }

    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
