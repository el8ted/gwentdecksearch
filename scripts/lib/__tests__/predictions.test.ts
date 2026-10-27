import { describe, expect, it } from 'vitest'
import { pollBallot } from '../poll.ts'
import { parsePredictions, sheetRef } from '../predictions.ts'
import { CATEGORIES } from '../whatif.ts'
import { DATA } from './analysis-data.ts'

const [POWER_UP, POWER_DOWN, PROV_UP, PROV_DOWN] = CATEGORIES

// The real sheet's layout, trimmed: a title, the header row with a side table to its right, lists of uneven length,
// blank rows, then the legend.
const CSV = [
  ',,,,,,,,',
  ',Predicted Changes,,,,,,,',
  ',-1 power,+1 power ,-1 prov,+1 prov,,Buff Brackets,,',
  ',NG Kolgrim (VK***),MO Nekker (VK**),0 Royal Decree (VK*),MO Caranthir Ar-Feiniel (MD),,MO,4,',
  ',,ST Farseer (OQ**),"NG Ffion var Gaernel (MD, SL*)",NG Prophet (EC*),,NG,9,',
  ',,,,,,,,',
  ',"MD = MetallicDanny; SL=Shinmiri&Lerio. In bold changes lerio2 views as very likely to happen.",,,,,,,',
].join('\n')

describe('sheetRef', () => {
  it('takes the tab from the link, else the first tab; anything but a Google Sheet is refused', () => {
    // Act / Assert
    expect(sheetRef('https://docs.google.com/spreadsheets/d/abc_1-x/edit?gid=5#gid=7')).toEqual({
      id: 'abc_1-x',
      gid: '7',
    })
    expect(sheetRef('https://docs.google.com/spreadsheets/d/abc/edit?gid=5')).toEqual({ id: 'abc', gid: '5' })
    expect(sheetRef('https://docs.google.com/spreadsheets/d/abc')).toEqual({ id: 'abc', gid: '0' })
    expect(sheetRef('https://docs.google.com/forms/d/e/abc/viewform')).toBeUndefined()
    expect(sheetRef('http://docs.google.com/spreadsheets/d/abc')).toBeUndefined()
    expect(sheetRef('not a link')).toBeUndefined()
  })
})

describe('parsePredictions', () => {
  it('reads each list column down to its first blank cell, drops the faction, and keeps the title and legend', () => {
    // Act
    const poll = parsePredictions(CSV)

    // Assert: lists in ballot order, whatever the sheet's column order
    expect(poll).toEqual({
      title: 'Predicted Changes',
      lists: [
        { category: POWER_UP, options: ['Nekker (VK**)', 'Farseer (OQ**)'] },
        { category: POWER_DOWN, options: ['Kolgrim (VK***)'] },
        { category: PROV_UP, options: ['Caranthir Ar-Feiniel (MD)', 'Prophet (EC*)'] },
        { category: PROV_DOWN, options: ['Royal Decree (VK*)', 'Ffion var Gaernel (MD, SL*)'] },
      ],
      skipped: ['Buff Brackets'],
      notes: ['MD = MetallicDanny; SL=Shinmiri&Lerio. In bold changes lerio2 views as very likely to happen.'],
    })
  })

  it('writes a ballot, not a poll: who recommended each card as its comment, the legend in the header', () => {
    // Act
    const text = pollBallot(parsePredictions(CSV), 'https://docs.google.com/spreadsheets/d/x', '2026-10-27', DATA, {
      source: 'sheet',
      poll: false,
    })

    // Assert
    expect(text).toContain('Notes from the sheet are kept as comments.\n# MD = MetallicDanny;')
    expect(text).not.toMatch(/^Poll$/m)
    expect(text).toContain('Power decrease\n- Kolgrim   # Kolgrim (VK***)\n')
    expect(text).toContain('- Ffion var Gaernel   # Ffion var Gaernel (MD, SL*)\n')
  })

  it('fails loudly when no column names a list, and falls back to a default title', () => {
    // Act / Assert
    expect(() => parsePredictions('a,b\nc,d')).toThrow('No column names a power or provision list')
    expect(parsePredictions('+1 power\nNG Kolgrim').title).toBe('Predictions')
  })
})
