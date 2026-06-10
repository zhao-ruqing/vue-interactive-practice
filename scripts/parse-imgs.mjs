import { readFileSync, writeFileSync } from 'fs'

const raw = readFileSync('../111.txt', 'utf-8')
const lines = raw.split(/\r?\n/).filter(l => l.trim())

function deepParse(str) {
  let current = str
  while (true) {
    try {
      const parsed = JSON.parse(current)
      if (typeof parsed === 'object' && parsed !== null) {
        // 找最内层的 msg 字段
        const inner = parsed.msg || parsed.rsp_msg || parsed.data
        if (typeof inner === 'string') {
          current = inner
          continue
        }
      }
      return parsed
    } catch {
      return current
    }
  }
}

const results = []
let i = 0
while (i < lines.length) {
  const line = lines[i]
  // label lines (Chinese text, not JSON)
  if (!line.startsWith('{') && !line.startsWith('}') && line.length < 50) {
    const label = line
    i++
    // collect JSON lines
    let jsonStr = ''
    while (i < lines.length && (lines[i].startsWith('{') || lines[i].startsWith('}') || jsonStr)) {
      jsonStr += lines[i]
      i++
      // try parse to see if complete
      try {
        JSON.parse(jsonStr)
        break
      } catch {}
    }
    const base64 = deepParse(jsonStr)
    if (typeof base64 === 'string' && base64.startsWith('iVBOR')) {
      results.push({ label, base64 })
    }
  } else {
    // standalone JSON line (one-liner)
    let jsonStr = line
    i++
    // check if next line is also JSON continuation or a label
    const base64 = deepParse(jsonStr)
    if (typeof base64 === 'string' && base64.startsWith('iVBOR')) {
      results.push({ label: `图片${results.length + 1}`, base64 })
    }
  }
}

writeFileSync('../src/views/GSAP/images.json', JSON.stringify(results, null, 2))
console.log(`Extracted ${results.length} images`)
