import { describe, expect, it } from 'vitest'
import { type Creator, creatorAliases, creatorName, type GuideVideo, seedCreators } from '../creators.ts'

const video = (author: string, channel: string, lang = 'en'): GuideVideo => ({
  author,
  lang,
  channel,
  channelTitle: ` ${channel} title `,
})

describe('creatorName and creatorAliases', () => {
  it('shows the first Gwent name, else the channel title, and finds every other name once', () => {
    // Arrange
    const person: Creator = {
      gwent: ['alkso', 'Alkso2'],
      channels: [
        { id: 'UC1', title: 'Electric 000', lang: 'en' },
        { id: 'UC2', title: 'ALKSO', lang: 'en' },
      ],
    }
    const group: Creator = { channels: [{ id: 'UC3', title: 'Independent Coalition', lang: 'ru' }] }

    // Act / Assert
    expect(creatorName(person)).toBe('alkso')
    expect(creatorAliases(person)).toEqual(['Alkso2', 'Electric 000'])
    expect(creatorName(group)).toBe('Independent Coalition')
    expect(creatorAliases(group)).toEqual([])
  })
})

describe('seedCreators', () => {
  it("takes a channel as an author's own only when at least 3 of its guide videos are all theirs", () => {
    // Arrange
    const videos = [
      ...['ru', 'en', 'ru'].map((lang) => video('alkso', 'UC1', lang)),
      video('Gintonic38', 'UC2'),
      video('Inveit', 'UC2'),
      video('gintonic38', 'UC2'),
      video('Pahan95', 'UC3'),
      video('Pahan95', 'UC3'),
    ]

    // Act
    const added = seedCreators(videos, [])

    // Assert: the shared channel and the one with 2 videos are left for a person to decide
    expect(added).toEqual([{ gwent: ['alkso'], channels: [{ id: 'UC1', title: 'UC1 title', lang: 'ru' }] }])
  })

  it('never touches what the registry already has, by channel or by Gwent name', () => {
    // Arrange
    const videos = [1, 2, 3].flatMap(() => [video('Qcento', 'UC1'), video('lerio2', 'UC2')])
    const known: Creator[] = [
      { gwent: ['Qcento'], channels: [{ id: 'UC9', title: 'Qcento', lang: 'en' }] },
      { channels: [{ id: 'UC2', title: 'Lerio Gwent', lang: 'pl' }] },
    ]

    // Act / Assert
    expect(seedCreators(videos, known)).toEqual([])
  })
})
