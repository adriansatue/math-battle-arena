import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AnswerRequestError,
  RESULT_HOLD_MS,
  getResultHoldMs,
  submitAnswerRequest,
  submitAnswerWithRetry,
} from '@/lib/game/answer-submission'

describe('answer submission UX', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps confirmed feedback visible for a stable duration', () => {
    expect(RESULT_HOLD_MS).toBe(800)
  })

  it('keeps mistakes visible longer than correct answers', () => {
    expect(getResultHoldMs(true)).toBe(650)
    expect(getResultHoldMs(false)).toBe(1200)
  })

  it('aborts a stalled request without treating it as an incorrect answer', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))

    const rejection = expect(submitAnswerRequest('/answer', { answer_given: 4 }, 100))
      .rejects.toEqual(expect.objectContaining<Partial<AnswerRequestError>>({
        kind: 'timeout',
      }))
    await vi.advanceTimersByTimeAsync(100)
    await rejection
  })

  it('retries a failed request once with the same payload', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_correct: true })))
    vi.stubGlobal('fetch', fetchMock)

    const states: string[] = []
    const response = await submitAnswerWithRetry('/answer', { answer_given: 4 }, state => states.push(state))

    expect(response.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body)
    expect(states).toEqual(['submitting', 'retrying'])
  })
})