// 파일 내보내기: 텍스트, SVG(색 변수 해석), PNG (PRD v2 §12.5)

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  // CSV는 엑셀이 한글을 읽도록 BOM을 붙인다
  const body = type.startsWith('text/csv') ? '﻿' + text : text
  downloadBlob(new Blob([body], { type }), filename)
}

/** CSS 변수(var(--x))를 실제 색으로 바꾼 독립 SVG 문자열 */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const root = getComputedStyle(document.documentElement)
  const resolve = (v: string) => v.replace(/var\((--[\w-]+)\)/g, (_, name: string) => root.getPropertyValue(name).trim() || '#000')
  const walk = (el: Element) => {
    for (const attr of Array.from(el.attributes)) if (attr.value.includes('var(')) el.setAttribute(attr.name, resolve(attr.value))
    for (const c of Array.from(el.children)) walk(c)
  }
  walk(clone)
  // 축 글자처럼 CSS 클래스로만 정한 스타일을 최소한으로 넣는다
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `text{font-family:${resolve('var(--font)')};font-size:11px;fill:#515154}.axis line,.axis path{stroke:#86868b}.axis-title{font-size:12px;fill:#1d1d1f}`
  clone.insertBefore(style, clone.firstChild)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const vb = svg.viewBox.baseVal
  if (vb && vb.width) {
    clone.setAttribute('width', String(vb.width))
    clone.setAttribute('height', String(vb.height))
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
}

export function downloadSvg(svg: SVGSVGElement, filename: string) {
  downloadText(serializeSvg(svg), filename, 'image/svg+xml;charset=utf-8')
}

export async function downloadPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const text = serializeSvg(svg)
  const vb = svg.viewBox.baseVal
  const w = vb?.width || svg.clientWidth
  const h = vb?.height || svg.clientHeight
  const img = new Image()
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok()
      img.onerror = () => fail(new Error('SVG 이미지 변환 실패'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
    if (blob) downloadBlob(blob, filename)
  } finally {
    URL.revokeObjectURL(url)
  }
}
