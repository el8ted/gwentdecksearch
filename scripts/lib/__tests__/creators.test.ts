import { describe, expect, it } from 'vitest'
import {
  type Creator,
  creatorAliases,
  creatorEvidence,
  creatorName,
  type GuideVideo,
  seedCreators,
} from '../creators.ts'

const video = (author: string, channel: string, lang = 'en'): GuideVideo => ({
  author,
  lang,
  channel,
  channelTitle: ` ${channel} title `,
})

describe('creatorName and creatorAliases', () => {
  it('credits the channel name, and finds the confirmed Gwent IDs and other channels once each', () => {
    // Arrange
    const person: Creator = {
      gwent: ['alkso', 'RGT_Makstron', 'electric 000'],
      channels: [
        { id: 'UC1', title: 'Electric 000', lang: 'en' },
        { id: 'UC2', title: 'ALKSO', lang: 'en' },
      ],
    }
    const group: Creator = { channels: [{ id: 'UC3', title: 'Independent Coalition', lang: 'ru' }] }

    // Act / Assert
    expect(creatorName(person)).toBe('Electric 000')
    expect(creatorAliases(person)).toEqual(['alkso', 'RGT_Makstron'])
    expect(creatorName(group)).toBe('Independent Coalition')
    expect(creatorAliases(group)).toEqual([])
  })
})

describe('seedCreators', () => {
  it('adds a channel at least 3 of whose videos one guide author embeds, channel only: no guessed Gwent ID', () => {
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
    expect(added).toEqual([{ channels: [{ id: 'UC1', title: 'UC1 title', lang: 'ru' }] }])
  })

  it('never touches a channel the registry already has', () => {
    // Arrange
    const videos = [1, 2, 3].map(() => video('lerio2', 'UC2'))
    const known: Creator[] = [{ channels: [{ id: 'UC2', title: 'Lerio Gwent', lang: 'pl' }], skip: true }]

    // Act / Assert
    expect(seedCreators(videos, known)).toEqual([])
  })
})

describe('creatorEvidence', () => {
  it('counts the guide authors a channel links and those embedding it, and lists unconfirmed ones seen twice or more', () => {
    // Arrange
    const creator: Creator = { gwent: ['RGT_Makstron'], channels: [{ id: 'UC1', title: 'Electric 000', lang: 'ru' }] }
    const links = { UC1: ['g1', 'g2', 'g3', 'g4'], UC9: ['g1'] }
    const guideAuthor = new Map([
      ['g1', 'alkso'],
      ['g2', 'alkso'],
      ['g3', 'Necrotal'],
    ])
    const embeds = [video('alkso', 'UC1'), video('alkso', 'UC1'), video('x', 'UC9')]

    // Act
    const found = creatorEvidence(creator, links, guideAuthor, embeds)

    // Assert
    expect(found).toEqual({
      linked: [
        ['alkso', 2],
        ['Necrotal', 1],
      ],
      embedding: [['alkso', 2]],
      toCheck: ['alkso'],
    })
  })
})
