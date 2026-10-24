import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Dev-only endpoint behind /bake.html. The page paints every planet on the GPU and PUTs the encoded pictures
 * here; they are written to public/baked/ (shipped as-is) and listed in src/data/baked.json (bundled).
 *
 *   PUT  /__bake/file/<name>   raw bytes of one picture
 *   POST /__bake/manifest      { surface: { id: Pic }, tex: { key: Pic } }  merged into baked.json
 *
 * Only reachable from this machine, and only while `vite` (dev) is running.
 */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(webp|png|jpg)$/;
const LOCAL = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/;
const LIMIT = 64 * 1024 * 1024;

interface Pic {
  w: number;
  h: number;
  c: string;
  a?: string;
}
interface Manifest {
  version: string;
  surface: Record<string, Pic>;
  tex: Record<string, Pic>;
}

export function bakeSink(): Plugin {
  return {
    name: 'solaris-bake-sink',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root;
      const dir = path.join(root, 'public', 'baked');
      const manifestPath = path.join(root, 'src', 'data', 'baked.json');

      const readManifest = (): Manifest => {
        try {
          return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
        } catch {
          return { version: 'none', surface: {}, tex: {} };
        }
      };

      server.middlewares.use('/__bake', (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (!LOCAL.test(req.socket.remoteAddress ?? '')) return send(403, { error: 'local only' });

        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > LIMIT) {
            send(413, { error: 'too large' });
            req.destroy();
            return;
          }
          chunks.push(c);
        });
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks);
            const url = (req.url ?? '').split('?')[0];

            if (req.method === 'PUT' && url.startsWith('/file/')) {
              const name = decodeURIComponent(url.slice(6));
              if (!NAME.test(name)) return send(400, { error: 'bad name' });
              fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(path.join(dir, name), body);
              return send(200, { name, bytes: body.length });
            }

            if (req.method === 'POST' && url === '/manifest') {
              const patch = JSON.parse(body.toString('utf8')) as Pick<Manifest, 'surface' | 'tex'>;
              const m = readManifest();
              m.surface = { ...m.surface, ...patch.surface };
              m.tex = { ...m.tex, ...patch.tex };
              const sort = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
              m.surface = sort(m.surface);
              m.tex = sort(m.tex);
              const used = new Set<string>();
              for (const p of [...Object.values(m.surface), ...Object.values(m.tex)]) {
                used.add(p.c);
                if (p.a) used.add(p.a);
              }
              m.version = createHash('sha1').update([...used].sort().join('|')).digest('hex').slice(0, 8);
              fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
              // rewriting an identical file would make the dev server reload the bake page for nothing
              const text = JSON.stringify(m, null, 2) + '\n';
              if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== text) fs.writeFileSync(manifestPath, text);
              // pictures that no entry points at any more (older bakes) are removed
              let removed = 0;
              if (fs.existsSync(dir)) {
                for (const f of fs.readdirSync(dir)) {
                  if (NAME.test(f) && !used.has(f)) {
                    fs.unlinkSync(path.join(dir, f));
                    removed++;
                  }
                }
              }
              return send(200, { version: m.version, files: used.size, removed });
            }

            return send(404, { error: 'unknown route' });
          } catch (e) {
            return send(500, { error: String(e) });
          }
        });
      });
    },
  };
}
