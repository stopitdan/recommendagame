'use client';

/**
 * Injects a JSON-LD structured data script tag into the page.
 * Works in client components where Next.js metadata API isn't available.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
