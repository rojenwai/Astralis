/** Minimal helpers for parsing the GCN classic notice HTML tables server-side. */

/** Split a GCN table page into data rows, each row as an array of cleaned cell strings. */
export function parseRows(html: string): string[][] {
  const rows: string[][] = [];
  const blocks = html.split(/<tr[^>]*>/i).slice(1);
  for (const block of blocks) {
    if (!/<td/i.test(block)) continue; // header rows contain <th> only
    const cells: string[] = [];
    const re = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) cells.push(clean(m[1]));
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function clean(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** GCN dates are "yy/mm/dd" + "hh:mm:ss.ss" in UT. Returns epoch ms or null. */
export function parseGcnDate(date: string, time: string): number | null {
  const d = date.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  const t = time.match(/^(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!d || !t) return null;
  const ms = Date.UTC(
    2000 + Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
    Math.floor(Number(t[3])),
  );
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Fetch with small backoff retries — the observatory edges (NOAA especially)
 * drop connections intermittently.
 */
export async function fetchRetry(url: string, timeoutMs = 25000, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "Astralis-art-installation/1.0" },
      });
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchText(url: string, timeoutMs = 25000): Promise<string> {
  return (await fetchRetry(url, timeoutMs)).text();
}

/**
 * The GCN notice pages are huge (Fermi ≈ 8 MB) and served slowly, but they are in
 * reverse time order — everything recent lives in the first few hundred KB. Stream
 * the body and hang up once we have enough; a truncated final row parses as
 * incomplete cells and is dropped by parseRows.
 */
export async function fetchTextPartial(
  url: string,
  maxBytes: number,
  timeoutMs = 60000,
  attempts = 3,
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "Astralis-art-installation/1.0" },
      });
      if (!res.ok || !res.body) throw new Error(`${url} → ${res.status}`);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (received < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
      }
      await reader.cancel().catch(() => {});
      const buf = new Uint8Array(received);
      let off = 0;
      for (const c of chunks) {
        buf.set(c, off);
        off += c.length;
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(buf);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Deterministic 0..1 hash from a string (for stable pseudo-positions). */
export function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
