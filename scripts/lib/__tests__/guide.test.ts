import { describe, expect, it } from 'vitest'
import { guideInfo } from '../guide.ts'

describe('guideInfo', () => {
  it('counts words and distinct words, and finds the first embedded or linked YouTube video', () => {
    // Arrange
    const content = {
      ops: [
        { insert: 'Play Golden Nekker first. Then play Golden Nekker again!\n' },
        { insert: { image: '/uploads/x.png' } },
        { insert: 'see ', attributes: {} },
        { insert: 'my channel', attributes: { link: 'https://www.twitch.tv/me' } },
        { insert: { video: 'https://www.youtube.com/embed/NJnObo5kR34?showinfo=0' } },
        { insert: 'https://youtu.be/BBBBBBBBBBB' },
      ],
    }

    // Act
    const { info } = guideInfo(content)

    // Assert
    expect(info).toMatchObject({ words: 12, unique: 9, images: 1, video: 'https://youtu.be/NJnObo5kR34' })
  })

  it('reads the language only when the detector is sure', () => {
    // Act
    const [ru, padding] = [
      guideInfo({ ops: [{ insert: 'Немного тяжела в пилотировании, но поинтов может выдать много.' }] }),
      guideInfo({ ops: [{ insert: 'sjdhdhjxxkxjxhkfsktsksgskgglgdhdggkdgksgdgkdgdkgdgldggldgd' }] }),
    ].map((r) => r.info)

    // Assert
    expect(ru.lang).toBe('ru')
    expect(padding.lang).toBeUndefined()
  })

  it('shows padding as many words but few distinct ones', () => {
    // Act
    const { info } = guideInfo({ ops: [{ insert: 'text '.repeat(20) }] })

    // Assert
    expect([info.words, info.unique]).toEqual([20, 1])
  })

  it('counts Chinese and Japanese characters as words, and handles a guide with no content', () => {
    // Act
    const [zh, none] = [guideInfo({ ops: [{ insert: '卡牌卡组' }] }), guideInfo(null)].map((r) => r.info)

    // Assert
    expect([zh.words, zh.unique]).toEqual([4, 3])
    expect(none).toEqual({ words: 0, unique: 0, images: 0 })
  })
})
