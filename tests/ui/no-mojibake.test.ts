import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FILES_TO_SCAN = [
  'app',
  'components',
  'lib',
]

const MOJIBAKE_PATTERNS = [
  'Â',
  'Ã',
  'â€™',
  'â€œ',
  'â€�',
  'â€“',
  'â€”',
  'â€¦',
  'ï¿½',
  '\uFFFD',
]

const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.md', '.json'])

function collectFiles(dir: string): string[] {
  const fullDir = join(process.cwd(), dir)
  return readdirSync(fullDir).flatMap(entry => {
    const relativePath = `${dir}/${entry}`
    const fullPath = join(process.cwd(), relativePath)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') return []
      return collectFiles(relativePath)
    }

    const extension = entry.includes('.') ? entry.slice(entry.lastIndexOf('.')) : ''
    return EXTENSIONS.has(extension) ? [relativePath] : []
  })
}

describe('visible source text', () => {
  it('does not contain common mojibake sequences', () => {
    const files = FILES_TO_SCAN.flatMap(collectFiles)

    const offenders = files.flatMap(file => {
      const content = readFileSync(join(process.cwd(), file), 'utf8')
      return MOJIBAKE_PATTERNS
        .filter(pattern => content.includes(pattern))
        .map(pattern => `${file}: ${pattern}`)
    })

    expect(offenders).toEqual([])
  })
})
