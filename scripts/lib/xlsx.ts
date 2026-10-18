import { inflateRawSync } from 'node:zlib'

/** A sheet's hyperlinks by 1-based row, as `[0-based column, url]`. */
export type SheetLinks = Map<number, [col: number, url: string][]>

/**
 * Reads one file from a zip archive (stored or deflated) through its central directory.
 *
 * shortcut: no Zip64, fine for single-tab sheet exports (a few MB); upgrade if an archive passes 4 GB.
 *
 * @param zip - The archive
 * @param name - Path inside it
 * @returns The file's bytes, or `undefined` if it isn't there
 * @throws {Error} If the bytes aren't a zip archive
 */
export function unzip(zip: Buffer, name: string): Buffer | undefined {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error('Not a zip archive')
  let at = zip.readUInt32LE(end + 16)
  for (let i = zip.readUInt16LE(end + 10); i > 0; i--) {
    const nameLength = zip.readUInt16LE(at + 28)
    if (zip.toString('utf8', at + 46, at + 46 + nameLength) === name) {
      const local = zip.readUInt32LE(at + 42)
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      const data = zip.subarray(start, start + zip.readUInt32LE(at + 20))
      return zip.readUInt16LE(at + 10) === 0 ? data : inflateRawSync(data)
    }
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32)
  }
  return undefined
}

const attr = (tag: string, name: string) =>
  tag
    .match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
    ?.replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')

/**
 * Lists the hyperlinks of a one-tab sheet export (`export?format=xlsx&gid=…`). The CSV export keeps only a link's
 * text, which for a link chip is the target's title, not its URL.
 *
 * @param xlsx - The export
 * @returns Links by row; empty for a sheet without any
 */
export function sheetLinks(xlsx: Buffer): SheetLinks {
  const read = (name: string) => unzip(xlsx, name)?.toString('utf8') ?? ''
  const targets = new Map(
    [...read('xl/worksheets/_rels/sheet1.xml.rels').matchAll(/<Relationship\s[^>]*>/g)].map(([tag]) => [
      attr(tag, 'Id'),
      attr(tag, 'Target'),
    ]),
  )
  const links: SheetLinks = new Map()
  for (const [tag] of read('xl/worksheets/sheet1.xml').matchAll(/<hyperlink\s[^>]*>/g)) {
    const url = targets.get(attr(tag, 'r:id'))
    // A range ("C10:D10") links from its first cell.
    const [, letters = '', row = ''] = attr(tag, 'ref')?.match(/^([A-Z]+)(\d+)/) ?? []
    if (!url || !letters) continue
    const col = [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
    links.set(Number(row), [...(links.get(Number(row)) ?? []), [col, url]])
  }
  return links
}
