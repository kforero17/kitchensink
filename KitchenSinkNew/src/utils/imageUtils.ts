export function sanitizeImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  try {
    // Encode * which iOS NSURL treats as illegal in query params.
    // We only touch the querystring to avoid encoding the full path twice.
    const [base, query] = url.split('?');
    if (!query) return url.replace(/\*/g, '%2A');

    // Encode * in query portion only
    const sanitizedQuery = query.replace(/\*/g, '%2A');
    return `${base}?${sanitizedQuery}`;
  } catch {
    return url;
  }
} 