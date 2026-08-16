export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

export function isUsernameConflict(error: { code?: string } | null) {
  return error?.code === '23505'
}