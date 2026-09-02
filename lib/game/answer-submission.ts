export const ANSWER_REQUEST_TIMEOUT_MS = 4000
export const RESULT_HOLD_MS = 800
export const CORRECT_RESULT_HOLD_MS = 650
export const WRONG_RESULT_HOLD_MS = 1200
export const CHECKING_DELAY_MS = 150
export const SLOW_REQUEST_MS = 800

export type AnswerRequestState = 'idle' | 'submitting' | 'checking' | 'slow' | 'retrying' | 'failed'

export function getResultHoldMs(isCorrect: boolean) {
  return isCorrect ? CORRECT_RESULT_HOLD_MS : WRONG_RESULT_HOLD_MS
}

export class AnswerRequestError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'network'
  ) {
    super(message)
    this.name = 'AnswerRequestError'
  }
}

export async function submitAnswerRequest(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = ANSWER_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AnswerRequestError('The answer request timed out.', 'timeout')
    }
    throw new AnswerRequestError(
      error instanceof Error ? error.message : 'The answer request failed.',
      'network'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function submitAnswerWithRetry(
  url: string,
  body: Record<string, unknown>,
  onState: (state: AnswerRequestState) => void
): Promise<Response> {
  onState('submitting')
  const checkingTimer = setTimeout(() => onState('checking'), CHECKING_DELAY_MS)
  const slowTimer = setTimeout(() => onState('slow'), SLOW_REQUEST_MS)

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) onState('retrying')
        const response = await submitAnswerRequest(url, body)
        if (response.status < 500 || attempt === 1) return response
      } catch (error) {
        if (!(error instanceof AnswerRequestError) || attempt === 1) throw error
      }
    }
    throw new AnswerRequestError('The answer request failed.', 'network')
  } finally {
    clearTimeout(checkingTimer)
    clearTimeout(slowTimer)
  }
}