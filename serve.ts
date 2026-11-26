// A tiny static server for game/ (Node 22, standard library only), so the game can be
// played locally without a build step: `node serve.ts [--port 8080]` serves game/ on
// http://localhost:8080. It refuses any path outside game/ and is a development
// convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const path = join(root, rel === '' || rel === '.' ? 'index.html' : rel);
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let file = path;
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const stat = statSync(file);
    response.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': stat.size,
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(port, () => {
  console.log(`Kestrel Valley Air Rally at http://localhost:${port}`);
});
