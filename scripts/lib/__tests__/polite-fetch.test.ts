import { setTimeout as sleep } from 'node:timers/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPoliteFetch, NotFoundError } from '../polite-fetch.ts'

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }))
vi.mock('consola', () => ({ consola: { warn: vi.fn() } }))

const URL_A = 'https://example.test/a'
const delays = { 'example.test': 1000 }
const respond = (status: number, body = '', headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : body, { status, headers })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('createPoliteFetch', () => {
  it('fetches the body', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(respond(200, 'hello'))
    const get = createPoliteFetch(delays)

    // Act
    const body = await get(URL_A)

    // Assert
    expect(body).toBe('hello')
  })

  it('sends the identifying user agent', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(respond(200, 'x'))
    const get = createPoliteFetch(delays)

    // Act
    await get(URL_A)

    // Assert
    expect(fetchMock.mock.calls[0][1].headers['user-agent']).toContain('gwent-deck-search')
  })

  it('sets a timeout on each request', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(respond(200, 'x'))
    const get = createPoliteFetch(delays)

    // Act
    await get(URL_A)

    // Assert
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('retries when the body stalls past the timeout', async () => {
    // Arrange
    const stalled = new Response('x')
    stalled.text = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'))
    fetchMock.mockResolvedValueOnce(stalled).mockResolvedValueOnce(respond(200, 'ok'))
    const get = createPoliteFetch(delays)

    // Act
    const result = await get(URL_A)

    // Assert
    expect(result).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throttles a second request to the same host', async () => {
    // Arrange
    fetchMock.mockImplementation(async () => respond(200, 'x'))
    const get = createPoliteFetch(delays)

    // Act
    await get(URL_A)
    await get(URL_A)

    // Assert
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('refuses hosts without a configured throttle', async () => {
    // Arrange
    const get = createPoliteFetch(delays)

    // Act
    const act = get('https://other.test/')

    // Assert
    await expect(act).rejects.toThrow('No throttle configured')
  })

  it('throws NotFoundError for a 404', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(respond(404))
    const get = createPoliteFetch(delays)

    // Act
    const act = get(URL_A)

    // Assert
    await expect(act).rejects.toBeInstanceOf(NotFoundError)
  })

  it('honors Retry-After on 429, then succeeds', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(respond(429, '', { 'retry-after': '7' })).mockResolvedValueOnce(respond(200, 'ok'))
    const get = createPoliteFetch(delays)

    // Act
    const result = await get(URL_A)

    // Assert
    expect(result).toBe('ok')
    expect(sleep).toHaveBeenCalledWith(7000)
  })

  it('backs off on network errors and gives up after three retries', async () => {
    // Arrange
    fetchMock.mockRejectedValue(new Error('ECONNRESET'))
    const get = createPoliteFetch(delays)

    // Act
    const act = get(URL_A)

    // Assert
    await expect(act).rejects.toThrow('ECONNRESET')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(sleep).toHaveBeenCalledWith(20_000)
  })

  it('fails immediately on a non-retryable status', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(respond(403))
    const get = createPoliteFetch(delays)

    // Act
    const act = get(URL_A)

    // Assert
    await expect(act).rejects.toThrow('HTTP 403')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
