import { describe, expect, it } from 'vitest'
import { isFormUrl, optionLines, parseForm, pollBallot, pollFileName } from '../poll.ts'
import { CATEGORIES } from '../whatif.ts'
import { DATA } from './analysis-data.ts'

/** A form page as Google serves it: the questions in a `FB_PUBLIC_LOAD_DATA_` script. */
const page = (title: string, questions: [string, string[]][]) => {
  const qs = questions.map(([q, options], i) => [i, q, null, 4, [[i, options.map((o) => [o, null, null, null, 0])]]])
  return `<html><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify([null, ['intro', qs, null, null, null, null, null, null, title]])};</script></html>`
}
const [POWER_UP, POWER_DOWN, PROV_UP, PROV_DOWN] = CATEGORIES

describe('isFormUrl', () => {
  it('takes Google Form links only', () => {
    // Act / Assert
    expect(isFormUrl('https://docs.google.com/forms/d/e/abc/viewform')).toBe(true)
    expect(isFormUrl('https://forms.gle/xyz')).toBe(true)
    expect(isFormUrl('https://docs.google.com/spreadsheets/d/abc')).toBe(false)
    expect(isFormUrl('http://docs.google.com/forms/d/e/abc/viewform')).toBe(false)
    expect(isFormUrl('not a link')).toBe(false)
  })
})

describe('parseForm', () => {
  it("maps each question to a ballot list by its wording, in either form's style, and lists the rest as skipped", () => {
    // Arrange
    const html = page('BC37 poll', [
      ['Power + / Siła +', ['Kolgrim']],
      ['Which of the following cards would you support for Power Decrease? (select all that apply)', ['Nekker']],
      ['Provisions – / Koszt –', ['Royal Decree']],
      ['Which cards would you support for Provision Increase?', ['Caranthir Ar-Feiniel', 'Farseer']],
      ['Your nickname', []],
      ['Anything else?', ['Yes', 'No']],
    ])

    // Act
    const poll = parseForm(html)

    // Assert
    expect(poll).toEqual({
      title: 'BC37 poll',
      lists: [
        { category: POWER_UP, options: ['Kolgrim'] },
        { category: POWER_DOWN, options: ['Nekker'] },
        { category: PROV_DOWN, options: ['Royal Decree'] },
        { category: PROV_UP, options: ['Caranthir Ar-Feiniel', 'Farseer'] },
      ],
      skipped: ['Your nickname', 'Anything else?'],
    })
  })

  it('fails loudly on a page without form data, or a form without ballot lists', () => {
    // Act / Assert
    expect(() => parseForm('<html></html>')).toThrow('No form data')
    expect(() => parseForm(page('x', [['Favourite faction?', ['MO']]]))).toThrow('No power or provision lists')
  })
})

describe('optionLines', () => {
  it('writes the full card name when one card matches, keeping the option as a comment', () => {
    // Act / Assert
    expect(optionLines('Kolgrim', DATA)).toEqual(['- Kolgrim'])
    expect(optionLines('Ffion var Gaernel (NG Defender)', DATA)).toEqual([
      '- Ffion var Gaernel   # Ffion var Gaernel (NG Defender)',
    ])
    expect(optionLines('Caranthir/ Каранир', DATA)).toEqual(['- Caranthir Ar-Feiniel   # Caranthir/ Каранир'])
  })

  it('splits "A & B" when the whole matches no card, and leaves anything else as written, for whatif to stop on', () => {
    // Act / Assert
    expect(optionLines('Kolgrim & Royal Decree', DATA)).toEqual([
      '- Kolgrim   # Kolgrim & Royal Decree',
      '- Royal Decree   # Kolgrim & Royal Decree',
    ])
    expect(optionLines('Kolgrim & Zzz', DATA)).toEqual(['- Kolgrim & Zzz'])
    expect(optionLines('Usurper (placeholder nerf)', DATA)).toEqual(['- Usurper   # Usurper (placeholder nerf)'])
    expect(optionLines('先知', DATA)).toEqual(['- 先知'])
  })
})

describe('pollBallot and pollFileName', () => {
  it('writes a Poll file whatif reads, named after the poll and the date', () => {
    // Arrange
    const poll = parseForm(page('Shinmiri’s & Lerio’s BC37 Ideas!', [['Power +', ['Kolgrim', 'Nekker']]]))

    // Act
    const text = pollBallot(poll, 'https://forms.gle/x', '2026-10-22', DATA)

    // Assert
    expect(text).toContain('# Read from https://forms.gle/x on 2026-10-22')
    expect(text).toContain('Poll\n\nPower increase\n- Kolgrim\n- Nekker\n')
    expect(pollFileName(poll.title, '2026-10-22')).toBe('shinmiri-s-lerio-s-bc37-ideas-2026-10-22.txt')
    expect(pollFileName('Ça va?', '2026-10-22')).toBe('ca-va-2026-10-22.txt')
    expect(pollFileName('!!!', '2026-10-22')).toBe('poll-2026-10-22.txt')
  })
})
