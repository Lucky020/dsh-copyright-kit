#!/usr/bin/env node
/**
 * 冒烟测试：不启动 DSH，用 mock ctx 完成注册 + 三个工具的真实执行。
 * 运行：node test/smoke.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { apply, name, inject } from '../lib/index.js'

const registered = new Map()
const ctx = {
  tools: {
    register(tool) {
      assert.ok(tool && typeof tool.name === 'string', 'tool.name 缺失')
      assert.ok(typeof tool.description === 'string' && tool.description.length > 10, `${tool.name} 描述太短`)
      assert.equal(typeof tool.parameters, 'object', `${tool.name} 缺少 parameters`)
      assert.equal(typeof tool.execute, 'function', `${tool.name} 缺少 execute`)
      assert.equal(typeof tool.output?.render, 'function', `${tool.name} 缺少 output.render`)
      assert.equal(typeof tool.output?.schema, 'object', `${tool.name} 缺少 output.schema`)
      registered.set(tool.name, tool)
      return () => registered.delete(tool.name)
    },
  },
  effect(fn, label) {
    const dispose = fn()
    assert.equal(typeof dispose, 'function', `effect 未返回 disposer: ${label}`)
    return dispose
  },
}

test_registration()
await test_status()
await test_source_doc()
await test_manual()
await test_screens()
await test_apply_info()
await test_pack()
await test_delivery()
console.log('\n✓ smoke passed:', [...registered.keys()].join(', '))

function test_registration() {
  assert.equal(name, 'dsh-copyright-kit')
  assert.deepEqual(inject, ['tools'])
  apply(ctx)
  assert.deepEqual(
    [...registered.keys()].sort(),
    [
      'copyright_apply_info', 'copyright_kit_status', 'copyright_manual',
      'copyright_pack', 'copyright_screens', 'copyright_source_doc',
      'delivery_catalog', 'delivery_doc',
    ],
  )
}

function workdir() {
  return mkdtempSync(path.join(tmpdir(), 'copyright-kit-'))
}

async function test_status() {
  const result = await registered.get('copyright_kit_status').execute({})
  assert.equal(result.python_ok, true, 'python3 不可用')
  assert.equal(result.python_docx_ok, true, 'python-docx 未安装')
  assert.equal(result.srcgen_ok, true)
  assert.equal(result.manualgen_ok, true)
}

async function test_source_doc() {
  const dir = workdir()
  const repo = path.join(dir, 'demo-repo')
  mkdirSync(path.join(repo, 'app'), { recursive: true })
  // 造 4000 行源码，确保走到「前 30 页 + 后 30 页」
  const body = Array.from({ length: 1700 }, (_, i) => `def func_${i}(x):\n    return x + ${i}`).join('\n')
  writeFileSync(path.join(repo, 'app', 'main.py'), `${body}\n`)
  writeFileSync(path.join(repo, 'app', 'unused.png'), 'binary')
  mkdirSync(path.join(repo, 'node_modules', 'x'), { recursive: true })
  writeFileSync(path.join(repo, 'node_modules', 'x', 'should_skip.js'), 'var a = 1\n')

  const out = path.join(dir, 'out', '源程序.docx')
  const result = await registered.get('copyright_source_doc').execute({
    root: repo,
    software_name: '测试系统软件',
    version: 'V1.0',
    out_path: out,
  })
  assert.equal(result.mode, 'head-tail')
  assert.equal(result.pages, 60)
  assert.equal(result.submitted_lines, 3000)
  assert.ok(existsSync(out), '未生成 docx')
  assert.ok(statSync(out).size > 10_000)

  const text = readFileSync(out, 'base64')
  assert.ok(text.length > 0)
  console.log('  source_doc ok:', result.pages, 'pages,', result.submitted_lines, 'lines')
}

async function test_screens() {
  const { findChrome } = await import('../lib/screens.js')
  if (!findChrome()) {
    console.log('  screens skipped: 没找到 Chrome')
    return
  }
  const dir = workdir()
  const spec = {
    software_name: '测试系统软件',
    version: 'V1.0',
    nav: ['总览', '台账'],
    width: 1600,
    height: 1000,
    scale: 1,
    screens: [
      {
        id: '01',
        title: '总览',
        active: '总览',
        blocks: [
          { type: 'kpis', items: [{ label: '设备总数', value: '1,286', sub: '在用 1,204' }] },
          {
            type: 'table', title: '设备状态', span: 8, toneColumns: [1],
            columns: ['编号', '状态'], rows: [['EQ-001', '运行中'], ['EQ-002', '停机']],
          },
          { type: 'list', title: '告警', span: 4, items: [{ title: '温度偏高', tag: '紧急' }] },
        ],
      },
    ],
  }
  const specPath = path.join(dir, 'screens.json')
  writeFileSync(specPath, JSON.stringify(spec))
  const result = await registered.get('copyright_screens').execute({ spec_path: specPath, out_dir: path.join(dir, 'shots') })
  assert.equal(result.count, 1)
  assert.ok(existsSync(result.images[0].png), '未生成 PNG')
  const png = readFileSync(result.images[0].png)
  assert.equal(png.subarray(1, 4).toString(), 'PNG', '产物不是 PNG')
  assert.ok(statSync(result.images[0].png).size > 20_000)
  console.log('  screens ok:', result.images[0].width, 'x', result.images[0].height)
}

async function test_apply_info() {
  const dir = workdir()
  const repo = path.join(dir, 'repo')
  mkdirSync(path.join(repo, 'app'), { recursive: true })
  writeFileSync(path.join(repo, 'app', 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()\n')
  writeFileSync(path.join(repo, 'requirements.txt'), 'fastapi==0.110\nsqlalchemy\npsycopg2\n')
  const spec = {
    software_name: '测试系统软件',
    version: 'V1.0',
    sections: [
      { heading: '引言', level: 1 },
      { heading: '功能说明', level: 1 },
      { heading: '订单管理', level: 2, paragraphs: ['订单创建与流转。'] },
      { heading: '库存查询', level: 2, paragraphs: ['实时查询库存。'] },
    ],
  }
  const specPath = path.join(dir, 'spec.json')
  writeFileSync(specPath, JSON.stringify(spec))
  const out = path.join(dir, 'apply.md')
  const result = await registered.get('copyright_apply_info').execute({
    root: repo,
    software_name: '测试系统软件',
    spec_path: specPath,
    out_path: out,
    developer: '某某公司',
  })
  assert.equal(result.features, 2)
  assert.ok(result.source_lines >= 2)
  assert.ok(result.summary.includes('订单管理'), '功能简介应包含功能模块')
  assert.ok(existsSync(out), '未生成 Markdown')
  const md = readFileSync(out, 'utf8')
  assert.ok(md.includes('软件全称') && md.includes('某某公司'))
  assert.ok(md.includes('fastapi') || md.includes('FastAPI'), '应识别出 FastAPI')
  console.log('  apply_info ok:', result.source_lines, 'lines,', result.features, 'features')
}

async function test_pack() {
  const dir = workdir()
  const repo = path.join(dir, 'repo')
  mkdirSync(path.join(repo, 'app'), { recursive: true })
  writeFileSync(path.join(repo, 'app', 'main.py'), 'def run():\n    return 1\n')
  const spec = {
    software_name: '批量测试软件',
    version: 'V1.0',
    sections: [
      { heading: '功能说明', level: 1 },
      { heading: '订单管理', level: 2, paragraphs: ['订单创建。'] },
    ],
  }
  const specPath = path.join(dir, 'spec.json')
  writeFileSync(specPath, JSON.stringify(spec))
  const manifestPath = path.join(dir, 'batch.json')
  writeFileSync(manifestPath, JSON.stringify({
    out_dir: path.join(dir, 'out'),
    software: [{ name: '批量测试软件', root: repo, spec: specPath }],
  }))
  const result = await registered.get('copyright_pack').execute({ manifest_path: manifestPath })
  assert.equal(result.count, 1)
  assert.equal(result.ok_count, 1)
  const item = result.items[0]
  assert.ok(item.ok, item.error)
  const kinds = item.files.map((f) => f.kind).sort()
  assert.deepEqual(kinds, ['apply_info', 'manual', 'source_doc'])
  assert.ok(existsSync(item.files.find((f) => f.kind === 'manual').path))
  console.log('  pack ok:', item.files.length, 'files')
}

async function test_delivery() {
  const dir = workdir()
  const repo = path.join(dir, 'repo')
  mkdirSync(path.join(repo, 'app', 'models'), { recursive: true })
  writeFileSync(path.join(repo, 'app', 'models', 'order.py'), [
    'from sqlalchemy import Column, BigInteger, String, DateTime',
    'from app.core.database import Base',
    '',
    'class Order(Base):',
    '    __tablename__ = "orders"',
    '    id = Column(BigInteger, primary_key=True)',
    '    tenant_id = Column(BigInteger)',
    '    order_no = Column(String(64))',
    '    created_at = Column(DateTime)',
  ].join('\n'))
  writeFileSync(path.join(repo, 'requirements.txt'), 'fastapi\nsqlalchemy\npsycopg2\n')

  const catalog = await registered.get('delivery_catalog').execute({ root: repo, software_name: '测试系统' })
  assert.ok(catalog.docs.length >= 9, '目录应至少 9 份文档')
  assert.equal(catalog.project.tables, 1)

  const out = path.join(dir, 'out', '数据库设计文档.docx')
  const doc = await registered.get('delivery_doc').execute({
    doc_id: 'database', root: repo, software_name: '测试系统', out_path: out,
  })
  assert.ok(existsSync(out), '未生成数据库设计文档')
  assert.equal(doc.tables, 1)
  assert.ok(doc.sections > 20)

  // 使用说明书：系统没跑时应给出补图提示，而不是编内容
  const manual = await registered.get('delivery_doc').execute({
    doc_id: 'user-manual', root: repo, software_name: '测试系统',
    out_path: path.join(dir, 'out', '使用说明书.docx'),
    base_url: 'http://127.0.0.1:59999',
  })
  assert.ok(manual.missing.some((m) => m.includes('未运行')), '应提示系统未运行')
  console.log('  delivery ok:', catalog.docs.length, 'docs,', doc.sections, 'sections')
}

async function test_manual() {
  const dir = workdir()
  const spec = {
    software_name: '测试系统软件',
    version: 'V1.0',
    sections: [
      { heading: '引言', level: 1, paragraphs: ['本文档用于说明系统功能。'] },
      { heading: '系统概述', level: 2, paragraphs: ['系统面向运维人员。'], bullets: ['设备台账', '巡检计划'] },
      {
        heading: '功能模块',
        level: 2,
        table: { header: ['模块', '说明'], rows: [['台账', '设备基础信息'], ['巡检', '计划与执行']] },
      },
    ],
  }
  const specPath = path.join(dir, 'spec.json')
  writeFileSync(specPath, JSON.stringify(spec, null, 2))
  const out = path.join(dir, 'out', '说明书.docx')
  const result = await registered.get('copyright_manual').execute({ spec_path: specPath, out_path: out })
  assert.equal(result.sections, 3)
  assert.equal(result.tables, 3)
  assert.ok(existsSync(out), '未生成说明书 docx')
  assert.ok(statSync(out).size > 8_000)
  console.log('  manual ok:', result.sections, 'sections,', result.chars, 'chars')
}
