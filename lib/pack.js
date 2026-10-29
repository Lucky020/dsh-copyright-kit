/**
 * 批量出件：一份 manifest → 每个软件一套完整材料。
 *
 * 单件失败不影响其它件，最后汇总成功/失败清单。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { renderScreens } from './screens.js'
import { runPython, PY_DIR } from './pyrun.js'

const SRCGEN = path.join(PY_DIR, 'srcgen.py')
const MANUALGEN = path.join(PY_DIR, 'manualgen.py')
const APPLYINFO = path.join(PY_DIR, 'applyinfo.py')
const CODEEXTRACT = path.join(PY_DIR, 'codeextract.py')

function safeName(name) {
  return name.replace(/[/\\:*?"<>|]/g, '_')
}

/** 把截图按「屏幕标题 === 章节标题」注入说明书 spec，已有 image 的章节不覆盖。 */
export function injectScreens(spec, images) {
  const byTitle = new Map(images.map((i) => [i.title, i]))
  let injected = 0
  for (const section of spec.sections || []) {
    if (section.image) continue
    const hit = byTitle.get(section.heading)
    if (hit) {
      section.image = hit.png
      section.caption = section.caption || `图 ${images.indexOf(hit) + 1}  ${hit.title}`
      injected += 1
    }
  }
  return injected
}

async function buildOne(entry, defaults, outRoot, signal) {
  const name = entry.name
  const version = entry.version || defaults.version || 'V1.0'
  const root = entry.root || defaults.root
  if (!root) throw new Error('缺少 root')
  if (!existsSync(root)) throw new Error(`root 不存在: ${root}`)

  const dir = path.join(outRoot, safeName(name))
  mkdirSync(dir, { recursive: true })
  const files = []

  // 1. 源程序鉴别材料
  const docx = path.join(dir, `${safeName(name)}_${version}_源程序.docx`)
  const srcArgs = ['--root', root, '--name', name, '--version', version, '--out', docx]
  for (const ex of entry.exclude || defaults.exclude || []) srcArgs.push('--exclude', ex)
  const src = await runPython(SRCGEN, srcArgs, signal)
  if (!src.payload?.ok) throw new Error('源程序文档生成失败')
  files.push({ kind: 'source_doc', path: docx, pages: src.payload.pages, lines: src.payload.submitted_lines })

  // 2. 界面截图
  let images = []
  if (entry.screens) {
    const spec = JSON.parse(readFileSync(entry.screens, 'utf8'))
    const shotDir = path.join(dir, 'screens')
    const merged = { ...spec, software_name: name, version }
    const rendered = await renderScreens(merged, shotDir, signal)
    images = rendered.images
    files.push({ kind: 'screens', path: shotDir, count: rendered.count })
  }

  // 3. 软件说明书
  if (entry.spec) {
    const spec = JSON.parse(readFileSync(entry.spec, 'utf8'))
    spec.software_name = spec.software_name || name
    spec.version = spec.version || version
    spec.developer = spec.developer || entry.developer || defaults.developer || ''
    spec.date = spec.date || entry.date || defaults.date || '' 
    const injected = images.length ? injectScreens(spec, images) : 0
    // 附录：从代码里数出接口/数据表/目录，补足篇幅且可核对
    let appendix = null
    if (entry.appendix !== false) {
      const appxPath = path.join(dir, '_appendix.json')
      try {
        const ex = await runPython(CODEEXTRACT, ['--root', root, '--out', appxPath], signal)
        if (ex.payload?.ok) appendix = appxPath
      } catch {
        appendix = null // 前端仓库之类没有接口/模型，跳过
      }
    }
    const resolved = path.join(dir, '_spec.resolved.json')
    writeFileSync(resolved, JSON.stringify(spec, null, 2), 'utf8')
    const manual = path.join(dir, `${safeName(name)}_${version}_说明书.docx`)
    const manualArgs = ['--spec', resolved, '--out', manual]
    if (appendix) manualArgs.push('--append', appendix)
    const out = await runPython(MANUALGEN, manualArgs, signal)
    if (!out.payload?.ok) throw new Error('说明书生成失败')
    files.push({
      kind: 'manual', path: manual, sections: out.payload.sections,
      images: out.payload.images, injected, pages: out.payload.est_pages,
      appendix: Boolean(appendix),
    })
  }

  // 4. 申请表填报信息
  const applyMd = path.join(dir, `${safeName(name)}_申请表信息.md`)
  const applyArgs = ['--root', root, '--name', name, '--version', version, '--out', applyMd]
  if (entry.spec) applyArgs.push('--spec', entry.spec)
  if (entry.domain || defaults.domain) applyArgs.push('--domain', entry.domain || defaults.domain)
  applyArgs.push('--developer', entry.developer || defaults.developer || '待填写')
  for (const ex of entry.exclude || defaults.exclude || []) applyArgs.push('--exclude', ex)
  const apply = await runPython(APPLYINFO, applyArgs, signal)
  if (!apply.payload?.ok) throw new Error('申请表信息生成失败')
  files.push({ kind: 'apply_info', path: applyMd, source_lines: apply.payload.source_lines, warnings: apply.payload.warnings.length })

  return { name, version, dir, ok: true, files }
}

export async function runBatch(manifest, signal) {
  const outRoot = path.resolve(manifest.out_dir || './copyright-out')
  const defaults = manifest.defaults || {}
  const entries = manifest.software || []
  if (!entries.length) throw new Error('manifest.software 为空')
  mkdirSync(outRoot, { recursive: true })

  const items = []
  for (const entry of entries) {
    try {
      items.push(await buildOne(entry, defaults, outRoot, signal))
    } catch (err) {
      items.push({ name: entry.name, dir: path.join(outRoot, safeName(entry.name || 'unknown')), ok: false, error: err.message })
    }
  }
  return {
    out_dir: outRoot,
    count: items.length,
    ok_count: items.filter((i) => i.ok).length,
    items,
  }
}
