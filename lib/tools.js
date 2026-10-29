import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { renderScreens, findChrome } from './screens.js'
import { runBatch } from './pack.js'
import { runPython, PY_DIR, PYTHON } from './pyrun.js'

const SRCGEN = path.join(PY_DIR, 'srcgen.py')
const MANUALGEN = path.join(PY_DIR, 'manualgen.py')
const APPLYINFO = path.join(PY_DIR, 'applyinfo.py')
const CODEEXTRACT = path.join(PY_DIR, 'codeextract.py')

const TEXT = (text) => [{ type: 'text', text }]

export function createStatusTool() {
  return {
    name: 'copyright_kit_status',
    description:
      '检查软著工坊的运行环境：python3、python-docx 是否可用，以及两个生成脚本是否存在。生成文档失败时先调用它。',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          python: { type: 'string' },
          python_ok: { type: 'boolean' },
          python_docx_ok: { type: 'boolean' },
          srcgen_ok: { type: 'boolean' },
          manualgen_ok: { type: 'boolean' },
          hint: { type: 'string' },
        },
        required: ['python', 'python_ok', 'python_docx_ok', 'srcgen_ok', 'manualgen_ok'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        `python: ${value.python} (${value.python_ok ? 'ok' : '不可用'})\n` +
        `python-docx: ${value.python_docx_ok ? 'ok' : '缺失'}\n` +
        `srcgen.py: ${value.srcgen_ok ? 'ok' : '缺失'}\n` +
        `manualgen.py: ${value.manualgen_ok ? 'ok' : '缺失'}` +
        (value.hint ? `\n提示: ${value.hint}` : ''),
      ),
    },
    async execute(args, exec) {
      const probe = await new Promise((resolve) => {
        const child = spawn(PYTHON, ['-c', 'import docx, sys; sys.stdout.write("docx-ok")'], {
          signal: exec?.signal,
        })
        let out = ''
        let err = ''
        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')
        child.stdout.on('data', (c) => { out += c })
        child.stderr.on('data', (c) => { err += c })
        child.on('error', (e) => resolve({ spawned: false, docx: false, err: e.message }))
        child.on('close', (code) => resolve({ spawned: true, docx: code === 0 && out.includes('docx-ok'), err }))
      })
      return {
        python: PYTHON,
        python_ok: probe.spawned,
        python_docx_ok: probe.docx,
        srcgen_ok: existsSync(SRCGEN),
        manualgen_ok: existsSync(MANUALGEN),
        hint: probe.docx ? '' : (probe.spawned ? '缺少依赖：python3 -m pip install python-docx' : `找不到 ${PYTHON}，可用 DSH_COPYRIGHT_PYTHON 指定解释器`),
      }
    },
  }
}

export function createSourceDocTool() {
  return {
    name: 'copyright_source_doc',
    description:
      '生成软件著作权登记用的「源程序鉴别材料」Word 文档：从代码仓库按规则抽取前 30 页 + 后 30 页（不足 60 页全量），每页 50 行，页眉自动标注软件名称与版本号、右上角自动页码。用于软著申请，也可用于代码归档交付。',
    parameters: {
      type: 'object',
      properties: {
        root: { type: 'string', description: '代码仓库根目录的绝对路径' },
        software_name: { type: 'string', description: '软著登记的软件名称，例如「设备管理系统软件」' },
        version: { type: 'string', description: '版本号，默认 V1.0' },
        out_path: {
          type: 'string',
          description: '输出 .docx 的绝对路径；省略时写到 <root>/copyright-kit/<软件名>_<版本>_源程序.docx',
        },
        exclude: {
          type: 'array',
          items: { type: 'string' },
          description: '额外排除的路径片段（仓库内相对路径子串），例如 ["tests", "docs"]',
        },
      },
      required: ['root', 'software_name'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          docx: { type: 'string' },
          pages: { type: 'number' },
          files: { type: 'number' },
          total_lines: { type: 'number' },
          submitted_lines: { type: 'number' },
          mode: { type: 'string' },
        },
        required: ['docx', 'pages', 'files', 'total_lines', 'submitted_lines', 'mode'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        `已生成源程序文档：${value.docx}\n` +
        `页数 ${value.pages}（每页 50 行）· 收录 ${value.files} 个文件 · ` +
        `仓库 ${value.total_lines} 行 → 提交 ${value.submitted_lines} 行（${value.mode === 'head-tail' ? '前30页+后30页' : '全量'}）`,
      ),
    },
    async execute(args, exec) {
      const root = args.root
      const name = args.software_name
      const version = args.version || 'V1.0'
      const out = args.out_path || path.join(root, 'copyright-kit', `${name}_${version}_源程序.docx`)
      const argv = ['--root', root, '--name', name, '--version', version, '--out', out]
      for (const ex of args.exclude || []) argv.push('--exclude', ex)
      const { payload } = await runPython(SRCGEN, argv, exec?.signal)
      if (!payload?.ok) throw new Error('srcgen.py 未返回结构化结果')
      return {
        docx: payload.docx,
        pages: payload.pages,
        files: payload.files,
        total_lines: payload.total_lines,
        submitted_lines: payload.submitted_lines,
        mode: payload.mode,
      }
    },
  }
}

export function createManualTool() {
  return {
    name: 'copyright_manual',
    description:
      '把结构化的章节内容排版成软著《软件说明书》Word 文档并嵌入截图：自动编号标题、页眉软件名+版本号、右上角页码、图片居中带图注、表格套用网格线。内容由你（agent）先写进一个 JSON spec 文件，再用本工具排版。',
    parameters: {
      type: 'object',
      properties: {
        spec_path: { type: 'string', description: '说明书内容的 JSON 文件绝对路径（由 write 工具先写好）' },
        out_path: { type: 'string', description: '输出 .docx 的绝对路径' },
        appendix_root: {
          type: 'string',
          description: '可选：代码仓库路径。给出时自动从代码抽取「源代码组织 / 业务接口清单 / 数据表清单」三张附录表，补足篇幅且内容可核对',
        },
      },
      required: ['spec_path', 'out_path'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          docx: { type: 'string' },
          sections: { type: 'number' },
          images: { type: 'number' },
          est_pages: { type: 'number' },
          tables: { type: 'number' },
          chars: { type: 'number' },
        },
        required: ['docx', 'sections', 'images', 'tables', 'chars', 'est_pages'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        `已生成软件说明书：${value.docx}\n` +
        `章节 ${value.sections} · 图片 ${value.images} · 表格行 ${value.tables} · 正文 ${value.chars} 字 · 约 ${value.est_pages} 页`,
      ),
    },
    async execute(args, exec) {
      const argv = ['--spec', args.spec_path, '--out', args.out_path]
      if (args.appendix_root) {
        const appx = path.join(path.dirname(args.out_path), '_appendix.json')
        const ex = await runPython(CODEEXTRACT, ['--root', args.appendix_root, '--out', appx], exec?.signal)
        if (ex.payload?.ok) argv.push('--append', appx)
      }
      const { payload } = await runPython(MANUALGEN, argv, exec?.signal)
      if (!payload?.ok) throw new Error('manualgen.py 未返回结构化结果')
      return {
        docx: payload.docx,
        sections: payload.sections,
        images: payload.images,
        tables: payload.tables,
        chars: payload.chars,
        est_pages: payload.est_pages,
      }
    },
  }
}

export function createScreensTool() {
  return {
    name: 'copyright_screens',
    description:
      '批量生成软著用的界面截图：按一份 JSON spec 渲染同一套壳（侧栏/顶栏/配色/字阶）下的多张 B2B 控制台页面，用 headless Chrome 截成 2 倍高清 PNG。内容块支持 kpis / table / list / chart / progress / form / timeline，状态标签按文案自动配色。用于软著说明书插图，也可用于投标、宣传材料。',
    parameters: {
      type: 'object',
      properties: {
        spec_path: { type: 'string', description: '截图 spec JSON 的绝对路径（由 write 工具先写好）' },
        out_dir: { type: 'string', description: 'PNG 输出目录；省略时用 spec 里的 out_dir 或 spec 同级的 screens/ 目录' },
      },
      required: ['spec_path'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          count: { type: 'number' },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                png: { type: 'string' },
                html: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
              },
              required: ['id', 'title', 'png', 'html', 'width', 'height'],
              additionalProperties: false,
            },
          },
        },
        required: ['count', 'images'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        `已生成 ${value.count} 张截图：\n` +
        value.images.map((i) => `  ${i.id}  ${i.title}  ${i.width}×${i.height}  ${i.png}`).join('\n'),
      ),
    },
    async execute(args, exec) {
      let spec
      try {
        spec = JSON.parse(readFileSync(args.spec_path, 'utf8'))
      } catch (err) {
        throw new Error(`读取 spec 失败：${err.message}`)
      }
      if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
        throw new Error('spec.screens 必须是非空数组')
      }
      const outDir = args.out_dir || spec.out_dir || path.join(path.dirname(args.spec_path), 'screens')
      return renderScreens(spec, outDir, exec?.signal)
    },
  }
}

export function createApplyInfoTool() {
  return {
    name: 'copyright_apply_info',
    description:
      '推导软件著作权登记申请表的填报信息：从代码仓库统计源程序量与编程语言、从依赖清单识别框架与数据库、从 git 历史取开发完成日期、从说明书 spec 提取功能模块，输出一份可粘贴的 Markdown 填报单（含 300 字功能简介草稿与技术特点）。算不出来的字段标 ⚠ 待人工确认。',
    parameters: {
      type: 'object',
      properties: {
        root: { type: 'string', description: '代码仓库根目录的绝对路径' },
        software_name: { type: 'string', description: '软著登记的软件全称' },
        version: { type: 'string', description: '版本号，默认 V1.0' },
        spec_path: { type: 'string', description: '说明书 spec JSON（可选；给了才能提取功能模块）' },
        out_path: { type: 'string', description: '输出 Markdown 的绝对路径；省略时写到 <root>/copyright-kit/<软件名>_申请表信息.md' },
        domain: { type: 'string', description: '面向领域，例如「工业设备运行与维护管理」；省略时按名称与章节关键词推断' },
        developer: { type: 'string', description: '著作权人（公司或个人名称）' },
        exclude: {
          type: 'array',
          items: { type: 'string' },
          description: '排除的路径片段，应与 copyright_source_doc 保持一致，否则源程序量会和工作量对不上',
        },
      },
      required: ['root', 'software_name'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          md: { type: 'string' },
          source_lines: { type: 'number' },
          features: { type: 'number' },
          summary: { type: 'string' },
          summary_chars: { type: 'number' },
          completed_date: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } },
        },
        required: ['md', 'source_lines', 'features', 'summary', 'summary_chars', 'completed_date', 'warnings'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        `申请表填报单：${value.md}\n` +
        `源程序量 ${value.source_lines} 行 · 功能模块 ${value.features} 个 · 开发完成日期 ${value.completed_date || '待填写'}\n` +
        `功能简介草稿（${value.summary_chars} 字）：${value.summary}` +
        (value.warnings.length ? `\n⚠ ${value.warnings.join('\n⚠ ')}` : ''),
      ),
    },
    async execute(args, exec) {
      const name = args.software_name
      const version = args.version || 'V1.0'
      const out = args.out_path || path.join(args.root, 'copyright-kit', `${name}_申请表信息.md`)
      const argv = ['--root', args.root, '--name', name, '--version', version, '--out', out]
      if (args.spec_path) argv.push('--spec', args.spec_path)
      if (args.domain) argv.push('--domain', args.domain)
      if (args.developer) argv.push('--developer', args.developer)
      for (const ex of args.exclude || []) argv.push('--exclude', ex)
      const { payload } = await runPython(APPLYINFO, argv, exec?.signal)
      if (!payload?.ok) throw new Error('applyinfo.py 未返回结构化结果')
      return {
        md: payload.md,
        source_lines: payload.source_lines,
        features: payload.features,
        summary: payload.summary,
        summary_chars: payload.summary_chars,
        completed_date: payload.completed_date,
        warnings: payload.warnings,
      }
    },
  }
}

export function createPackTool() {
  return {
    name: 'copyright_pack',
    description:
      '批量出件：按一份 manifest，为多个软件各生成一整套软著材料（源程序文档 + 界面截图 + 软件说明书 + 申请表填报单），每个软件一个目录。说明书里未指定插图的章节，会按「章节标题 === 截图标题」自动挂图。单件失败不影响其它件。',
    parameters: {
      type: 'object',
      properties: {
        manifest_path: { type: 'string', description: '批量清单 JSON 的绝对路径' },
      },
      required: ['manifest_path'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          out_dir: { type: 'string' },
          count: { type: 'number' },
          ok_count: { type: 'number' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                dir: { type: 'string' },
                ok: { type: 'boolean' },
                error: { type: 'string' },
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      kind: { type: 'string' },
                      path: { type: 'string' },
                      pages: { type: 'number' },
                      count: { type: 'number' },
                      sections: { type: 'number' },
                      images: { type: 'number' },
                      injected: { type: 'number' },
                      source_lines: { type: 'number' },
                      warnings: { type: 'number' },
                    },
                    required: ['kind', 'path'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['name', 'dir', 'ok'],
              additionalProperties: false,
            },
          },
        },
        required: ['out_dir', 'count', 'ok_count', 'items'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        `批量出件：${value.ok_count}/${value.count} 成功 → ${value.out_dir}\n` +
        value.items.map((i) => i.ok
          ? `  ✅ ${i.name}\n${i.files.map((f) => `      ${f.kind}: ${f.path}`).join('\n')}`
          : `  ❌ ${i.name} — ${i.error}`).join('\n'),
      ),
    },
    async execute(args, exec) {
      let manifest
      try {
        manifest = JSON.parse(readFileSync(args.manifest_path, 'utf8'))
      } catch (err) {
        throw new Error(`读取 manifest 失败：${err.message}`)
      }
      return runBatch(manifest, exec?.signal)
    },
  }
}

export const toolFactories = [createStatusTool, createSourceDocTool, createManualTool, createScreensTool, createApplyInfoTool, createPackTool]
