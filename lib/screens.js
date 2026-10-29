/**
 * 五屏界面渲染：结构化 spec → HTML → headless Chrome 截图。
 *
 * 设计目标：一套壳（侧栏/顶栏/配色/字阶）+ 可组合内容块，让同一软件的多张
 * 截图看起来是同一个系统，而不是五张各画各的图。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULTS = {
  width: 1600,
  height: 1000,
  scale: 2,
  accent: '#2563eb',
  sidebar: '#12263f',
}

const TONE_RULES = [
  { tone: 'bad', re: /紧急|严重|告警|故障|停机|离线|超期|失败|异常|低于安全库存/ },
  { tone: 'warn', re: /一般|预警|待机|逾期|接近|待处理|超时|警告/ },
  { tone: 'info', re: /维保中|处理中|进行中|执行中|待验收|派发/ },
  { tone: 'ok', re: /正常|运行中|已完成|已闭环|充足|在线|通过|已验收/ },
]

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tone(text) {
  const s = String(text ?? '')
  for (const rule of TONE_RULES) if (rule.re.test(s)) return rule.tone
  return ''
}

const CSS = (t) => `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
  background: #f5f7fa; color: #1f2937; width: ${t.width}px; height: ${t.height}px;
  display: flex; overflow: hidden; -webkit-font-smoothing: antialiased;
}
.side { width: 220px; background: ${t.sidebar}; color: #cbd5e1; display: flex; flex-direction: column; flex: none; }
.logo { padding: 20px 20px 18px; }
.logo b { display: block; font-size: 17px; font-weight: 600; color: #fff; letter-spacing: .4px; }
.logo small { display: block; font-size: 10.5px; color: #7d94b0; margin-top: 5px; line-height: 1.4; }
.nav { padding-top: 4px; }
.nav a { display: flex; align-items: center; gap: 10px; padding: 11px 20px; font-size: 14px; color: #cbd5e1; }
.nav a.on { background: #1b3a5c; color: #fff; box-shadow: inset 3px 0 0 ${t.accent}; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #64748b; flex: none; }
.nav a.on .dot { background: #60a5fa; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top { height: 60px; background: #fff; border-bottom: 1px solid #e5e9f0; display: flex; align-items: center; padding: 0 26px; justify-content: space-between; flex: none; }
.crumb { font-size: 13px; color: #6b7280; }
.crumb b { color: #111827; font-weight: 600; }
.user { font-size: 13px; color: #374151; }
.body { padding: 20px 24px; display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; align-content: stretch; overflow: hidden; }
.card { background: #fff; border: 1px solid #e5e9f0; border-radius: 8px; overflow: hidden; }
.card.pad { padding: 16px 18px; }
.hd { font-size: 14px; font-weight: 600; padding: 14px 18px; border-bottom: 1px solid #eef1f6; display: flex; justify-content: space-between; align-items: center; }
.hd span { font-size: 12px; color: ${t.accent}; font-weight: 400; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi .label { font-size: 13px; color: #6b7280; }
.kpi .num { font-size: 28px; font-weight: 600; margin-top: 8px; letter-spacing: .5px; }
.kpi .sub { font-size: 12px; color: #9ca3af; margin-top: 6px; }
.up { color: #059669; } .warnc { color: #d97706; } .badc { color: #dc2626; } .infoc { color: ${t.accent}; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-weight: 500; color: #6b7280; background: #fafbfd; padding: 10px 18px; border-bottom: 1px solid #eef1f6; font-size: 12px; white-space: nowrap; }
td { padding: 11px 18px; border-bottom: 1px solid #f4f6fa; color: #374151; }
tr:last-child td { border-bottom: 0; }
.tag { display: inline-block; font-size: 12px; padding: 2px 9px; border-radius: 10px; background: #f3f4f6; color: #6b7280; white-space: nowrap; }
.tag.ok { background: #ecfdf5; color: #047857; }
.tag.warn { background: #fffbeb; color: #b45309; }
.tag.bad { background: #fef2f2; color: #b91c1c; }
.tag.info { background: #eff6ff; color: #1d4ed8; }
.bar { height: 6px; border-radius: 3px; background: #eef2f7; overflow: hidden; }
.bar i { display: block; height: 100%; background: ${t.accent}; }
.bar i.ok { background: #10b981; } .bar i.warn { background: #f59e0b; } .bar i.bad { background: #ef4444; }
.list { padding: 4px 18px 12px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px dashed #eef1f6; font-size: 13px; }
.row:last-child { border-bottom: 0; }
.muted { color: #9ca3af; font-size: 12px; margin-top: 3px; }
.chart { height: 156px; display: flex; align-items: flex-end; gap: 24px; padding: 18px 24px 0; }
.col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.col i { display: block; width: 100%; background: linear-gradient(180deg, #7db3f7, ${t.accent}); border-radius: 4px 4px 0 0; }
.col em { font-style: normal; font-size: 12px; color: #6b7280; margin-top: 6px; }
.axis { display: flex; justify-content: space-between; padding: 4px 34px 12px; font-size: 12px; color: #9ca3af; }
.pad2 { padding: 12px 20px 16px; }
.metric { display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; padding: 6px 0; }
.metric b { color: #1f2937; font-weight: 600; }
.fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 18px; padding: 16px 18px; }
.field { border: 1px solid #e5e9f0; border-radius: 6px; padding: 9px 12px; background: #fbfcfe; }
.field label { display: block; font-size: 12px; color: #9ca3af; }
.field div { font-size: 13px; color: #1f2937; margin-top: 4px; }
.tl { padding: 8px 20px 16px; }
.tl .item { position: relative; padding: 0 0 16px 20px; border-left: 1px solid #e8edf4; }
.tl .item:last-child { border-left-color: transparent; padding-bottom: 2px; }
.tl .item::before { content: ''; position: absolute; left: -4.5px; top: 3px; width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
.tl .item.done::before { background: #10b981; }
.tl .item.active::before { background: ${t.accent}; }
.tl .t { font-size: 12px; color: #9ca3af; }
.tl .n { font-size: 13px; color: #1f2937; margin-top: 2px; }
.tl .d { font-size: 12px; color: #9ca3af; margin-top: 3px; }
`

function kpiBlock(block) {
  const items = block.items || []
  return `<div class="card pad" style="grid-column: span 12">
    <div class="kpis">${items.map((it) => `
      <div class="kpi">
        <div class="label">${esc(it.label)}</div>
        <div class="num ${it.tone === 'up' ? 'up' : it.tone === 'warn' ? 'warnc' : it.tone === 'bad' ? 'badc' : ''}">${esc(it.value)}</div>
        <div class="sub">${esc(it.sub || '')}</div>
      </div>`).join('')}
    </div>
  </div>`
}

function tableBlock(block) {
  const span = block.span || 8
  const cols = block.columns || []
  const rows = block.rows || []
  const statusCols = new Set(block.toneColumns || [])
  return `<div class="card" style="grid-column: span ${span}">
    <div class="hd">${esc(block.title || '')}${block.more ? `<span>${esc(block.more)}</span>` : ''}</div>
    <table>
      <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell, i) => {
        const auto = statusCols.has(i) || (statusCols.size === 0 && tone(cell))
        return auto && tone(cell)
          ? `<td><span class="tag ${tone(cell)}">${esc(cell)}</span></td>`
          : `<td>${esc(cell)}</td>`
      }).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`
}

function listBlock(block) {
  const span = block.span || 4
  return `<div class="card" style="grid-column: span ${span}">
    <div class="hd">${esc(block.title || '')}${block.more ? `<span>${esc(block.more)}</span>` : ''}</div>
    <div class="list">${(block.items || []).map((it) => `
      <div class="row">
        <div>${esc(it.title)}${it.sub ? `<div class="muted">${esc(it.sub)}</div>` : ''}</div>
        ${it.tag ? `<span class="tag ${it.tone || tone(it.tag)}">${esc(it.tag)}</span>` : ''}
      </div>`).join('')}</div>
  </div>`
}

function chartBlock(block) {
  const span = block.span || 6
  const bars = block.bars || []
  const max = block.max || Math.max(1, ...bars.map((b) => Number(b.value) || 0))
  return `<div class="card" style="grid-column: span ${span}">
    <div class="hd">${esc(block.title || '')}${block.unit ? `<span>${esc(block.unit)}</span>` : ''}</div>
    <div class="chart">${bars.map((b) => `
      <div class="col"><i style="height:${Math.max(6, Math.round((Number(b.value) / max) * 82))}%"></i><em>${esc(b.value)}</em></div>`).join('')}</div>
    <div class="axis">${bars.map((b) => `<span>${esc(b.label)}</span>`).join('')}</div>
  </div>`
}

function progressBlock(block) {
  const span = block.span || 4
  const bar = block.bar || {}
  const pct = Math.max(0, Math.min(100, Number(bar.value) || 0))
  return `<div class="card" style="grid-column: span ${span}">
    <div class="hd">${esc(block.title || '')}${block.more ? `<span>${esc(block.more)}</span>` : ''}</div>
    <div class="pad2">
      ${(block.metrics || []).map((m) => `<div class="metric"><span>${esc(m.label)}</span><b class="${m.tone === 'up' ? 'up' : m.tone === 'warn' ? 'warnc' : m.tone === 'bad' ? 'badc' : ''}">${esc(m.value)}</b></div>`).join('')}
      ${bar.label ? `<div class="metric"><span>${esc(bar.label)}</span><b>${pct}%</b></div>
      <div class="bar" style="height:8px;margin:6px 0 14px"><i class="${bar.tone || 'ok'}" style="width:${pct}%"></i></div>` : ''}
      ${(block.after || []).map((m) => `<div class="metric"><span>${esc(m.label)}</span><b class="${m.tone === 'up' ? 'up' : m.tone === 'warn' ? 'warnc' : ''}">${esc(m.value)}</b></div>`).join('')}
    </div>
  </div>`
}

function formBlock(block) {
  const span = block.span || 6
  return `<div class="card" style="grid-column: span ${span}">
    <div class="hd">${esc(block.title || '')}</div>
    <div class="fields">${(block.fields || []).map((f) => `
      <div class="field"><label>${esc(f.label)}</label><div>${esc(f.value || '')}</div></div>`).join('')}</div>
  </div>`
}

function timelineBlock(block) {
  const span = block.span || 4
  return `<div class="card" style="grid-column: span ${span}">
    <div class="hd">${esc(block.title || '')}</div>
    <div class="tl">${(block.items || []).map((it) => `
      <div class="item ${it.state || ''}">
        <div class="t">${esc(it.time || '')}</div>
        <div class="n">${esc(it.title || '')}</div>
        ${it.desc ? `<div class="d">${esc(it.desc)}</div>` : ''}
      </div>`).join('')}</div>
  </div>`
}

const BLOCKS = {
  kpis: kpiBlock,
  table: tableBlock,
  list: listBlock,
  chart: chartBlock,
  progress: progressBlock,
  form: formBlock,
  timeline: timelineBlock,
}

export function renderHtml(spec, screen) {
  const t = { ...DEFAULTS, ...(spec.theme || {}), width: spec.width || DEFAULTS.width, height: spec.height || DEFAULTS.height }
  const nav = screen.nav && screen.nav.length ? screen.nav : (spec.nav || [])
  const active = screen.active || screen.title
  const blocks = (screen.blocks || []).map((b) => {
    const fn = BLOCKS[b.type]
    if (!fn) throw new Error(`未知的 block 类型: ${b.type}`)
    return fn(b)
  }).join('\n')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>${esc(spec.software_name)} - ${esc(screen.title)}</title>
<style>${CSS(t)}</style></head>
<body>
  <aside class="side">
    <div class="logo"><b>${esc(spec.software_name)}</b><small>${esc(spec.subtitle || `${screen.title} · ${spec.version || 'V1.0'}`)}</small></div>
    <nav class="nav">${nav.map((n) => `<a class="${n === active ? 'on' : ''}"><i class="dot"></i>${esc(n)}</a>`).join('')}</nav>
  </aside>
  <div class="main">
    <div class="top">
      <div class="crumb">${esc((screen.crumb || [spec.software_name]).join(' / '))} / <b>${esc(screen.title)}</b></div>
      <div class="user">${esc(screen.user || spec.user || '')}${spec.time ? `　|　${esc(spec.time)}` : ''}</div>
    </div>
    <div class="body">${blocks}</div>
  </div>
</body></html>`
}

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

export function findChrome() {
  const explicit = process.env.DSH_COPYRIGHT_CHROME
  if (explicit && existsSync(explicit)) return explicit
  for (const c of CHROME_CANDIDATES) if (existsSync(c)) return c
  return null
}

function shoot(chrome, htmlPath, pngPath, { width, height, scale }, signal) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--no-default-browser-check', '--disable-extensions',
      `--force-device-scale-factor=${scale}`,
      `--window-size=${width},${height}`,
      '--virtual-time-budget=1200',
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ]
    const child = spawn(chrome, args, { signal })
    let err = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (c) => { err += c })
    child.on('error', (e) => reject(new Error(`无法启动 Chrome：${e.message}`)))
    child.on('close', (code) => {
      if (code === 0 && existsSync(pngPath)) resolve()
      else reject(new Error(`Chrome 截图失败（exit ${code}）\n${err.trim().slice(-800)}`))
    })
  })
}

/** 渲染全部屏幕，返回 { count, images }。 */
export async function renderScreens(spec, outDir, signal) {
  outDir = path.resolve(outDir)
  const chrome = findChrome()
  if (!chrome) {
    throw new Error('找不到 Chrome。装 Google Chrome，或把可执行文件路径设进环境变量 DSH_COPYRIGHT_CHROME。')
  }
  const screens = spec.screens || []
  if (!screens.length) throw new Error('spec.screens 为空')

  const htmlDir = path.join(outDir, '_html')
  mkdirSync(htmlDir, { recursive: true })

  const layout = {
    width: spec.width || DEFAULTS.width,
    height: spec.height || DEFAULTS.height,
    scale: spec.scale || DEFAULTS.scale,
  }
  const images = []
  for (let i = 0; i < screens.length; i += 1) {
    const screen = screens[i]
    const id = screen.id || `${String(i + 1).padStart(2, '0')}`
    const htmlPath = path.join(htmlDir, `${id}.html`)
    const pngPath = path.join(outDir, `${id}-${screen.title || 'screen'}.png`)
    writeFileSync(htmlPath, renderHtml(spec, screen), 'utf8')
    await shoot(chrome, htmlPath, pngPath, layout, signal)
    images.push({
      id,
      title: screen.title || '',
      png: pngPath,
      html: htmlPath,
      width: layout.width * layout.scale,
      height: layout.height * layout.scale,
    })
  }
  return { count: images.length, images }
}

export { tone }
