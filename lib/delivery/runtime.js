/**
 * 运行态探测与截图：系统还活着就自动截，没活就交回给人补。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { findChrome } from '../screens.js'

/** 探测地址是否可访问（3 秒超时）。 */
export async function probe(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    return { running: res.ok || res.status < 500, status: res.status, url }
  } catch (err) {
    return { running: false, status: 0, url, error: err.message }
  } finally {
    clearTimeout(timer)
  }
}

/** 用 headless Chrome 截一张图。 */
export function shoot(url, outPng, { width = 1600, height = 1000, scale = 2 } = {}) {
  const chrome = findChrome()
  if (!chrome) throw new Error('找不到 Chrome，无法自动截图；可用 DSH_COPYRIGHT_CHROME 指定可执行文件')
  mkdirSync(path.dirname(outPng), { recursive: true })
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--no-default-browser-check', '--disable-extensions',
      `--force-device-scale-factor=${scale}`,
      `--window-size=${width},${height}`,
      '--virtual-time-budget=2500',
      `--screenshot=${outPng}`,
      url,
    ])
    let err = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (c) => { err += c })
    child.on('error', (e) => reject(new Error(`Chrome 启动失败：${e.message}`)))
    child.on('close', (code) => {
      if (code === 0 && existsSync(outPng)) resolve(outPng)
      else reject(new Error(`截图失败（exit ${code}）\n${err.trim().slice(-500)}`))
    })
  })
}

/** 若给了 base_url，按页面清单批量截图；返回可用图片与不可用页面。 */
export async function capturePages(baseUrl, pages, outDir) {
  const ok = []
  const failed = []
  for (const page of pages || []) {
    const url = page.url || (page.path ? new URL(page.path, baseUrl).href : baseUrl)
    const safe = (page.title || 'page').replace(/[/\\:*?"<>|]/g, '_')
    const png = path.join(outDir, `${safe}.png`)
    try {
      await shoot(url, png)
      ok.push({ title: page.title || url, png, url })
    } catch (err) {
      failed.push({ title: page.title || url, url, error: err.message })
    }
  }
  return { ok, failed }
}
