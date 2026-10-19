const SITE = 'https://thefootballerssister.co.za';
const APP_ID = '1:65396604482:web:0f31625a714aa8352337db';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const id = new URL(req.url, SITE).searchParams.get('id');

  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).send('Invalid post link.');
  }

  const postPath = `/blog/?post=${encodeURIComponent(id)}`;
  const target = SITE + postPath;
  const shareUrl =
    `${SITE}/api/blog-share?id=${encodeURIComponent(id)}`;

  try {
    const path = [
      'artifacts',
      APP_ID,
      'public',
      'data',
      'blogPosts',
      id
    ].map(encodeURIComponent).join('/');

    const [postResponse, pageResponse] = await Promise.all([
      fetch(
        `https://firestore.googleapis.com/v1/projects/football-site-c3aa9/databases/(default)/documents/${path}`,
        { signal: AbortSignal.timeout(10000) }
      ),
      fetch(
        `${SITE}/blog/`,
        { signal: AbortSignal.timeout(10000) }
      )
    ]);

    if (!postResponse.ok || !pageResponse.ok) {
      const status = postResponse.status === 404 ? 404 : 503;

      const message = status === 404
        ? 'This post is no longer available.'
        : 'The post is temporarily unavailable.';

      return res.status(status).send(
        `<p>${message}</p>
         <a href="${escapeHtml(target)}">Open the blog post</a>`
      );
    }

    const [post, template] = await Promise.all([
      postResponse.json(),
      pageResponse.text()
    ]);

    const headMatch = template.match(
      /<head\b[^>]*>([\s\S]*?)<\/head>/i
    );

    if (!headMatch) {
      throw new Error('Blog page head missing');
    }

    const field = name =>
      post.fields?.[name]?.stringValue || '';

    const title =
      field('title') || "The Footballer's Sister";

    const description = (
      field('excerpt') || field('body')
    ).replace(/\s+/g, ' ').slice(0, 200);

    let image = '';

    try {
      const parsed = new URL(field('imageUrl'));

      if (['https:', 'http:'].includes(parsed.protocol)) {
        image = parsed.href;
      }
    } catch (_) {}

    const e = escapeHtml;

    // Replace generic metadata while preserving the page's
    // existing styles, scripts and other head elements.
    const cleanHead = headMatch[1]
      .replace(
        /<title\b[^>]*>[\s\S]*?<\/title>/gi,
        ''
      )
      .replace(
        /<meta\b[^>]*\b(?:name|property)\s*=\s*["'](?:description|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi,
        ''
      )
      .replace(
        /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/gi,
        ''
      );

    const metadata = `
<title>${e(title)} | The Footballer's Sister</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(target)}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="The Footballer's Sister">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(shareUrl)}">

${image ? `
<meta property="og:image" content="${e(image)}">
<meta property="og:image:alt" content="${e(title)}">
<meta name="twitter:image" content="${e(image)}">
` : ''}

<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(description)}">

<script>
  history.replaceState(null, '', ${JSON.stringify(postPath)});
</script>
`;

    // Return the actual blog page, with no intermediate
    // preview page and no browser redirect.
    const html = template.replace(
      headMatch[0],
      () =>
        `<head><meta charset="utf-8">${metadata}${cleanHead}</head>`
    );

    res.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=60'
    );

    return res.status(200).send(
      req.method === 'HEAD' ? '' : html
    );
  } catch (_) {
    return res.status(503).send(
      `<p>The post is temporarily unavailable.</p>
       <a href="${escapeHtml(target)}">Open the blog post</a>`
    );
  }
};