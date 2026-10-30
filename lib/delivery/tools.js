/**
 * 交付文档工具：先问「要哪几份」，再逐份生成；材料缺失返回 missing，不猜。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { DOC_CATALOG, catalogPayload } from './catalog.js'
import { buildDatabaseDoc } from './docs/database.js'
import { buildUserManualDoc } from './docs/user-manual.js'
import { BUILDERS as SPEC_BUILDERS, groupMenus, ensurePages } from './docs/specs.js'
import { capturePages, probe } from './runtime.js'
import { runPython, PY_DIR } from '../pyrun.js'

const CODEEXTRACT = path.join(PY_DIR, 'codeextract.py')
const MANUALGEN = path.join(PY_DIR, 'manualgen.py')
const TEXT = (text) => [{ type: 'text', text }]

const BUILDERS = {
  database: buildDatabaseDoc,
  'user-manual': buildUserManualDoc,
  ...SPEC_BUILDERS,
}

const TITLES = {
  database: '数 据 库 设 计 文 档',
  'user-manual': '使 用 说 明 书',
  'summary-design': '概 要 设 计 说 明 书',
  'detail-design': '详 细 设 计 说 明 书',
  'api-doc': '接 口 文 档',
  'test-report': '测 试 报 告',
  'online-report': '上 线 报 告',
  'acceptance-report': '验 收 报 告',
  'tech-agreement': '技 术 协 议',
}

/** 扫仓库，得到项目画像：表、接口、模块、数据库类型。 */
export async function scanProject(root, name, signal) {
  // 中间产物写到系统临时目录，不污染被扫描的仓库
  const work = path.join(tmpdir(), 'dsh-delivery')
  mkdirSync(work, { recursive: true })
  const dumpPath = path.join(work, 'models.json')
  await runPython(CODEEXTRACT, ['--root', root, '--out', path.join(work, 'appendix.json'), '--dump-models', dumpPath], signal)
  let raw = { models: [], routes: [], forms: [] }
  if (existsSync(dumpPath)) {
    try {
      raw = JSON.parse(readFileSync(dumpPath, 'utf8'))
    } catch {
      /* 保持空 */
    }
  }
  const depText = readDeps(root)
  const database = /postgres/i.test(depText)
    ? 'PostgreSQL'
    : /mysql/i.test(depText)
      ? 'MySQL'
      : /sqlite/i.test(depText)
        ? 'SQLite'
        : ''
  return {
    name,
    root,
    tables: raw.models.length,
    routes: raw.routes.length,
    modules: raw.forms.length,
    database,
    timeseries: /timescale/i.test(depText),
    cache: /redis/i.test(depText) ? 'Redis' : '',
    models: raw.models,
    routesRaw: raw.routes,
    forms: raw.forms,
    modelsList: raw.models.map((m) => ({ table: m.table, fields: m.fields })),
    stack: readStack(root),
    modulesList: groupModules(raw),
    missing: [],
  }
}

function groupModules(raw) {
  const groups = new Map()
  const SKIP = new Set(['api', 'v1', 'v2', 'rest', 'internal'])
  for (const r of raw.routes || []) {
    const seg = (r.path || '/').split('/').filter(Boolean)
    // 跳过 api/v1 这类版本前缀，取第一个业务段
    const key = seg.find((x) => !SKIP.has(x)) || 'root'
    if (!groups.has(key)) groups.set(key, 0)
    groups.set(key, groups.get(key) + 1)
  }
  const fromRoutes = [...groups.entries()]
    .filter(([k]) => k && k !== 'root')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, n]) => ({ name: k, desc: `该模块提供 ${n} 个接口。`, steps: [] }))
  if (fromRoutes.length) return fromRoutes
  return (raw.forms || []).slice(0, 12).map((f) => ({ name: f.name, desc: '', steps: [] }))
}

function readStack(root) {
  const pkg = path.join(root, 'package.json')
  if (!existsSync(pkg)) return {}
  try {
    const d = JSON.parse(readFileSync(pkg, 'utf8'))
    const dep = { ...(d.dependencies || {}), ...(d.devDependencies || {}) }
    return {
      vue: dep.vue,
      router: dep['vue-router'],
      element: dep['element-ui'] || dep.antd || dep['ant-design-vue'],
      build: dep['@vue/cli-service'] ? '@vue/cli' : dep.vite ? 'vite' : '',
    }
  } catch {
    return {}
  }
}

function readDeps(root) {
  const parts = []
  for (const f of ['pyproject.toml', 'requirements.txt', 'package.json', 'go.mod']) {
    const p = path.join(root, f)
    if (existsSync(p)) {
      try {
        parts.push(readFileSync(p, 'utf8'))
      } catch {
        /* 忽略 */
      }
    }
  }
  return parts.join('\n').toLowerCase()
}

export function createCatalogTool() {
  return {
    name: 'delivery_catalog',
    description:
      '列出交付验收材料里能自动生成哪些文档（数据库设计 / 概要设计 / 详细设计 / 接口文档 / 测试报告 / 上线报告 / 验收报告 / 技术协议 / 使用说明书），每份需要的材料、可自动化比例、以及能否直接生成。先把这份清单给用户看，问他需要哪几份，再调用 delivery_doc。',
    parameters: {
      type: 'object',
      properties: {
        root: { type: 'string', description: '可选：代码仓库路径，给出后会一并扫描项目规模（表数/接口数）' },
        software_name: { type: 'string', description: '可选：软件名称' },
      },
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          docs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                auto_ratio: { type: 'number' },
                required: { type: 'array', items: { type: 'string' } },
                optional: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'name', 'auto_ratio', 'required', 'optional'],
              additionalProperties: false,
            },
          },
          project: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              tables: { type: 'number' },
              routes: { type: 'number' },
              modules: { type: 'number' },
              missing: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'tables', 'routes', 'modules', 'missing'],
            additionalProperties: false,
          },
        },
        required: ['docs'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        '可生成的交付文档：\n' +
        value.docs.map((d) => `  ${d.id.padEnd(16)} ${d.name}  自动化 ${Math.round(d.auto_ratio * 100)}%` +
          (d.required.length ? `  需提供：${d.required.join('、')}` : '  可直接生成')).join('\n') +
        (value.project ? `\n\n项目：${value.project.name} · 表 ${value.project.tables} · 接口 ${value.project.routes}` : ''),
      ),
    },
    async execute(args, exec) {
      let project = null
      if (args.root) {
        const p = await scanProject(args.root, args.software_name || '', exec?.signal)
        project = { name: p.name, tables: p.tables, routes: p.routes, modules: p.modules, missing: p.missing }
      }
      return catalogPayload(project)
    },
  }
}

export function createDocTool() {
  return {
    name: 'delivery_doc',
    description:
      '生成一份交付文档（Word）。目前支持 database（数据库设计说明书），从代码的 ORM 模型直接生成。缺少素材时返回 missing 清单，由你去问用户，不要自己编。',
    parameters: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: '文档类型 id，见 delivery_catalog 返回的 docs[].id' },
        root: { type: 'string', description: '代码仓库绝对路径' },
        software_name: { type: 'string', description: '软件名称' },
        version: { type: 'string', description: '版本号，默认 V1.0' },
        developer: { type: 'string', description: '建设单位全称（出现在封面）' },
        out_path: { type: 'string', description: '输出 .docx 绝对路径' },
        base_url: { type: 'string', description: '使用说明书用：系统当前访问地址，如 http://127.0.0.1:8080（系统在运行才会自动截图）' },
        menus: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, route: { type: 'string' } },
            required: ['title'],
            additionalProperties: false,
          },
          description: '功能清单（标题 + 页面路由）。使用说明书之外的设计/测试/验收类文档需要它',
        },
        screenshots: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, path: { type: 'string' }, route: { type: 'string' } },
            required: ['title', 'path'],
            additionalProperties: false,
          },
          description: '使用说明书用：已有截图清单（标题 + 本地路径），给了就不再去系统里截',
        },
        pages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              path: { type: 'string' },
            },
            required: ['title'],
            additionalProperties: false,
          },
          description: '使用说明书用：要截图的页面清单（标题 + 相对路径）',
        },
      },
      required: ['doc_id', 'root', 'software_name', 'out_path'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          docx: { type: 'string' },
          doc_id: { type: 'string' },
          sections: { type: 'number' },
          tables: { type: 'number' },
          est_pages: { type: 'number' },
          missing: { type: 'array', items: { type: 'string' } },
        },
        required: ['docx', 'doc_id', 'sections', 'tables', 'est_pages', 'missing'],
        additionalProperties: false,
      },
      render: (args, value) => TEXT(
        `已生成：${value.docx}\n章节 ${value.sections} · 数据表 ${value.tables} · 约 ${value.est_pages} 页` +
        (value.missing.length ? `\n⚠ 仍需补充：${value.missing.join('、')}` : ''),
      ),
    },
    async execute(args, exec) {
      const meta = DOC_CATALOG.find((d) => d.id === args.doc_id)
      if (!meta) throw new Error(`未知文档类型：${args.doc_id}`)
      const builder = BUILDERS[args.doc_id]
      if (!builder) {
        throw new Error(`${meta.name} 还没有实现。当前可生成：${Object.keys(BUILDERS).join('、')}`)
      }

      const project = await scanProject(args.root, args.software_name, exec?.signal)
      project.name = args.software_name
      const menus = args.menus || (args.screenshots || []).map((s) => ({ title: s.title, route: s.route || '' }))

      // 使用说明书：系统在跑就自动截图，没跑就把缺口交回给人
      let screens = []
      const missing = [...(meta.need || [])]
      if (args.doc_id === 'user-manual') {
        const shotDir = path.join(path.dirname(args.out_path), 'screens')
        if (args.screenshots && args.screenshots.length) {
          screens = args.screenshots.map((s) => ({ title: s.title, png: s.path, route: s.route || '' }))
          project.modulesList = [] // 明确给了截图清单时，以截图标题作为章节顺序
        } else if (args.base_url) {
          const state = await probe(args.base_url)
          if (state.running) {
            if (!args.pages || !args.pages.length) {
              missing.push(`系统在运行（${args.base_url}），但没给页面清单：请提供要截图的页面标题与路径`)
            } else {
              const cap = await capturePages(args.base_url, args.pages, shotDir)
              screens = cap.ok
              for (const f of cap.failed) missing.push(`截图失败：${f.title}（${f.error.split('\n')[0]}）`)
            }
          } else {
            missing.push(`系统未运行（${args.base_url} 无法访问）：请启动后重试，或后期手动补截图（放到 ${shotDir}）`)
          }
        } else {
          missing.push(`未提供 base_url：系统未在运行或地址未知，请启动后提供地址自动截图，或后期手动补截图`)
        }
      } else if (!menus.length && ['summary-design', 'detail-design', 'test-report', 'online-report', 'acceptance-report', 'tech-agreement', 'api-doc'].includes(args.doc_id)) {
        missing.push('未提供功能清单（menus）：设计、测试与验收类文档需要菜单标题与页面路由')
      }

      let sections = builder({ project, models: project.models, screens, menus })
      // 数据库设计文档走独立模板，这里统一兜底到 25 页
      if (['database', 'user-manual'].includes(args.doc_id)) {
        sections = ensurePages(sections, { project, menus }, 25)
      }

      const spec = {
        software_name: args.software_name,
        version: args.version || 'V1.0',
        doc_title: TITLES[args.doc_id] || meta.name,
        developer: args.developer || '',
        date: '',
        cover: true,
        toc: true,
        page_number: 'top',
        sections,
      }
      const specPath = path.join(path.dirname(args.out_path), `_${args.doc_id}.spec.json`)
      mkdirSync(path.dirname(args.out_path), { recursive: true })
      writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf8')

      const { payload } = await runPython(MANUALGEN, ['--spec', specPath, '--out', args.out_path], exec?.signal)
      if (!payload?.ok) throw new Error('文档渲染失败')

      return {
        docx: args.out_path,
        doc_id: args.doc_id,
        sections: payload.sections,
        tables: project.tables,
        est_pages: payload.est_pages,
        missing,
      }
    },
  }
}
