// Supplies each blog post's image and title to link-sharing apps.
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

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const id = new URL(req.url, SITE).searchParams.get('id');

  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).send('Invalid post link.');
  }

  const target = `${SITE}/blog/?post=${encodeURIComponent(id)}`;
  const shareUrl = `${SITE}/api/blog-share?id=${encodeURIComponent(id)}`;

  try {
    const path = [
      'artifacts',
      APP_ID,
      'public',
      'data',
      'blogPosts',
      id
    ].map(encodeURIComponent).join('/');

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/football-site-c3aa9/databases/(default)/documents/${path}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) {
      const status = response.status === 404 ? 404 : 503;
      const message = status === 404
        ? 'This post is no longer available.'
        : 'The post preview is temporarily unavailable.';

      return res.status(status).send(
        `<p>${message}</p>
         <a href="${escapeHtml(target)}">Open the blog post</a>`
      );
    }

    const document = await response.json();

    const field = name =>
      document.fields?.[name]?.stringValue || '';

    const title = field('title') || "The Footballer's Sister";

    const description = (field('excerpt') || field('body'))
      .replace(/\s+/g, ' ')
      .slice(0, 200);

    let image = '';

    try {
      const parsed = new URL(field('imageUrl'));

      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        image = parsed.href;
      }
    } catch (_) {}

    const e = escapeHtml;

    const imageTags = image
      ? `<meta property="og:image" content="${e(image)}">
         <meta property="og:image:alt" content="${e(title)}">
         <meta name="twitter:image" content="${e(image)}">`
      : '';

    res.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=60'
    );

    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)} | The Footballer's Sister</title>
  <meta name="description" content="${e(description)}">
  <link rel="canonical" href="${e(target)}">

  <meta property="og:type" content="article">
  <meta property="og:site_name" content="The Footballer's Sister">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:url" content="${e(shareUrl)}">
  ${imageTags}

  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${e(title)}">
  <meta name="twitter:description" content="${e(description)}">
</head>
<body>
  <h1>${e(title)}</h1>
  <p>${e(description)}</p>
  <a href="${e(target)}">Read the full post</a>

  <script>
    window.location.replace(
      ${JSON.stringify(target).replace(/</g, '\\u003c')}
    );
  </script>
</body>
</html>`);
  } catch (_) {
    return res.status(503).send(
      `<p>The post preview is temporarily unavailable.</p>
       <a href="${escapeHtml(target)}">Open the blog post</a>`
    );
  }
};