import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { sheetLinks, unzip } from '../xlsx.ts'

/** A minimal zip archive: each file deflated, or stored when `stored`. */
function zip(files: Record<string, string>, stored = false): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const data = stored ? Buffer.from(text) : deflateRawSync(text)
    const nameBytes = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(stored ? 0 : 8, 8)
    local.writeUInt16LE(nameBytes.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(stored ? 0 : 8, 10)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, data)
    centrals.push(central, nameBytes)
    offset += 30 + nameBytes.length + data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

describe('unzip', () => {
  it('reads deflated and stored files, and nothing for a missing one', () => {
    // Arrange
    const deflated = zip({ 'a.txt': 'alpha', 'b.txt': 'beta' })
    const stored = zip({ 'a.txt': 'alpha' }, true)

    // Act
    const read = [unzip(deflated, 'b.txt'), unzip(stored, 'a.txt'), unzip(deflated, 'c.txt')]

    // Assert
    expect(read.map((b) => b?.toString())).toEqual(['beta', 'alpha', undefined])
  })

  it('throws for bytes that are not a zip archive', () => {
    // Act
    const act = () => unzip(Buffer.from('<html>error</html>'), 'a.txt')

    // Assert
    expect(act).toThrow('Not a zip archive')
  })
})

describe('sheetLinks', () => {
  it('lists hyperlinks by row and 0-based column, decoding entities', () => {
    // Arrange
    const xlsx = zip({
      'xl/worksheets/sheet1.xml':
        '<worksheet><hyperlinks><hyperlink r:id="rId1" ref="C10"/><hyperlink ref="AA10:AB10" r:id="rId2"/><hyperlink r:id="rId3" ref="D11"/></hyperlinks></worksheet>',
      'xl/worksheets/_rels/sheet1.xml.rels':
        '<Relationships><Relationship Id="rId1" Type="h" Target="https://youtu.be/a?x=1&amp;y=2" TargetMode="External"/><Relationship Target="https://b" Id="rId2"/><Relationship Id="rId3" Target="https://c"/></Relationships>',
    })

    // Act
    const links = sheetLinks(xlsx)

    // Assert
    expect([...links]).toEqual([
      [
        10,
        [
          [2, 'https://youtu.be/a?x=1&y=2'],
          [26, 'https://b'],
        ],
      ],
      [11, [[3, 'https://c']]],
    ])
  })
})
