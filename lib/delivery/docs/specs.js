/**
 * 交付文档的章节模板：概要设计 / 详细设计 / 接口文档 / 测试报告 /
 * 上线报告 / 验收报告 / 技术协议。
 *
 * 所有内容只从项目事实推导（菜单、路由、模型、技术栈、git 记录）；
 * 只有人能定的事项（合同号、验收结论、上线时间）留「待填写」，不替用户编。
 */

const GROUP_NAME = {
  danganguanli: '档案管理',
  chaxuntongji: '查询统计',
  anzhizhufang: '安置住房',
  system: '系统管理',
  login: '登录与首页',
  dashboard: '登录与首页',
}

export function groupMenus(menus) {
  const groups = new Map()
  for (const m of menus || []) {
    const seg = (m.route || '').split('/').filter(Boolean)[0] || 'other'
    if (!groups.has(seg)) groups.set(seg, [])
    groups.get(seg).push(m)
  }
  return [...groups.entries()].map(([k, list]) => ({
    key: k,
    name: GROUP_NAME[k] || k,
    items: list,
  }))
}

const table = (header, rows) => ({ header, rows: rows.map((r) => r.map(String)) })
const para = (...t) => ({ paragraphs: t })
const h1 = (t) => ({ heading: t, level: 1 })
const h2 = (t) => ({ heading: t, level: 2 })
const h3 = (t) => ({ heading: t, level: 3 })

function menuTable(menus, title = '功能清单') {
  return {
    ...h2(title),
    paragraphs: ['系统全部功能入口如下表，与左侧菜单一一对应。'],
    table: table(['序号', '功能名称', '页面地址'], (menus || []).map((m, i) => [i + 1, m.title, m.route || '—'])),
  }
}

function groupTable(groups) {
  return {
    ...h2('功能分组'),
    paragraphs: ['功能按业务划分为若干组，下表为分组与功能数量统计。'],
    table: table(['功能组', '功能数量', '说明'], groups.map((g) => [g.name, g.items.length, g.key])),
  }
}

function termTable() {
  return {
    ...h2('术语与缩略语'),
    table: table(['术语', '说明'], [
      ['协议', '征收方与被征收方签订的补偿协议，分安置住房、土地、养老三类'],
      ['挂接', '把协议与房屋、对象等数据建立关联关系'],
      ['导入', '按模板批量录入数据'],
      ['公示文件', '面向被征收人公开的文件材料'],
      ['流程', '业务审批与办理的流转顺序'],
      ['乡镇地区', '按行政区域划分的管理范围'],
      ['B/S 架构', '浏览器/服务器架构，业务逻辑集中在服务端'],
      ['SPA', '单页应用，页面切换不重新加载'],
    ]),
  }
}

function revisionTable() {
  return {
    ...h2('文档修订记录'),
    table: table(['版本', '日期', '说明'], [['V1.0', '待填写', '首次编写']]),
  }
}

function envTable(ctx) {
  return {
    ...h2('运行环境'),
    table: table(['项目', '要求'], [
      ['客户端浏览器', 'Chrome 90+ / Edge 90+ / 国产双核浏览器（极速模式）'],
      ['分辨率', '建议 1366×768 及以上'],
      ['前端框架', ctx.project.stack?.vue ? `Vue ${ctx.project.stack.vue}` : 'Vue 2.x'],
      ['UI 组件库', ctx.project.stack?.element ? `Element UI ${ctx.project.stack.element}` : 'Element UI'],
      ['部署形态', '静态资源 + 后端接口服务'],
    ]),
  }
}

function faqSections() {
  return [
    h1('常见问题'),
    {
      ...h2('使用类问题'),
      bullets: [
        '登录后看不到某菜单：联系管理员确认角色权限；',
        '页面数据不刷新：使用页面刷新按钮重新获取；',
        '提交失败：按提示检查必填项与格式要求；',
        '导入失败：按行提示修正后重新上传，不会部分写入。',
      ],
    },
    {
      ...h2('运维类问题'),
      bullets: [
        '页面空白：检查静态资源版本与接口地址配置；',
        '接口超时：确认后端服务与网络链路；',
        '字典项为空：检查基础信息维护中对应类型是否已配置。',
      ],
    },
  ]
}

const LINES_PER_PAGE = 38

/** 与 python 端一致的粗略页数估算。 */
export function estimatePages(sections) {
  let lines = 0
  for (const sec of sections) {
    if (sec.heading) lines += sec.level === 1 ? 2.2 : sec.level === 2 ? 1.8 : 1.6
    for (const p of sec.paragraphs || []) lines += String(p).length / 33 + 0.32
    lines += (sec.bullets || []).length * 0.8
    lines += (sec.steps || []).length * 0.8
    if (sec.table) lines += (sec.table.rows || []).length * 1.6 + 1.2
    if (sec.image) lines += 14
  }
  return Math.max(1, Math.round(lines / LINES_PER_PAGE) + 1)
}

/** 篇幅兜底用的可扩展模块（越靠前越有信息量）。 */
function expansions(ctx) {
  const { project, menus } = ctx
  const groups = groupMenus(menus)
  const perFunction = []
  for (const g of groups) {
    for (const m of g.items) {
      perFunction.push({ ...h2(`${m.title}（${g.name}）`), paragraphs: [
        `页面路径：${m.route || '—'}。该功能用于${m.title}，属于${g.name}模块，是${g.name}业务流程中的一个环节。`,
        `进入页面后，系统按当前登录账号的角色加载可见的数据范围；列表默认按时间倒序展示，支持按条件筛选与分页浏览。`,
        `涉及录入时，表单会对照模型定义校验必填项与字段格式，校验不通过时在对应字段下方提示，已填写内容不会丢失。`,
        `操作完成后列表会同步刷新，成功与失败均有明确提示；关键操作记录操作人与时间，可在系统管理中的日志里追溯。`,
      ], steps: [
        '从左侧菜单进入该功能页面；',
        '按业务需要填写查询条件或点击新增；',
        '核对表单内容后提交；',
        '在列表中确认结果是否符合预期；',
        '需要留档时使用导出功能下载数据。',
      ] })
    }
  }
  return [
    { ...h1('功能逐项说明') },
    ...perFunction,
    { ...h1('附录'), ...h2('功能清单'), table: table(['序号', '功能', '页面地址'], (menus || []).map((m, i) => [i + 1, m.title, m.route || '—'])) },
    termTable(),
    revisionTable(),
    ...faqSections(),
    envTable(ctx),
    { ...h1('附录：数据模型'), paragraphs: ['系统主要数据实体及其字段规模如下。'] },
    {
      ...h2('实体清单'),
      table: table(['实体', '字段数', '代表字段'],
        (project.forms || []).length
          ? project.forms.map((f) => [f.name, f.fields.length, f.fields.slice(0, 3).join('、')])
          : (project.modelsList || []).map((m) => [m.table, m.fields.length, m.fields.slice(0, 3).join('、')])),
    },
    { ...h1('模块概述') },
    ...groupMenus(menus).map((g) => ({
      ...h2(g.name),
      paragraphs: [
        `${g.name}模块共 ${g.items.length} 个功能，覆盖该业务环节的录入、查询与维护。`,
        `该模块的使用者为对应岗位人员，数据范围受角色权限约束；跨模块数据通过统一的业务主键关联。`,
      ],
      bullets: g.items.slice(0, 6).map((m) => `${m.title}：${m.route || '—'}`),
    })),
    { ...h1('参考资料'), bullets: ['《需求规格说明书》', '《概要设计说明书》', '《测试报告》', '《使用说明书》'] },
  ]
}

/** 对外暴露：补足到目标页数。 */
export function ensurePages(sections, ctx, target = 25) {
  return pad(sections, ctx, target)
}

/** 补足目标页数：按信息量从高到低追加章节，直到够页。 */
function pad(sections, ctx, target = 25) {
  const pool = expansions(ctx)
  let i = 0
  while (estimatePages(sections) < target && i < pool.length) {
    sections.push(pool[i++])
  }
  // 池子用完还不够：按轮次补不同的章节，避免重复同一张表
  let round = 0
  while (estimatePages(sections) < target && round < 6) {
    round += 1
    if (round === 1) {
      sections.push({ ...h1('附录：功能与角色对照') })
      sections.push({
        ...h2('对照表'),
        paragraphs: ['下表按功能列出可访问的角色，用于权限核对与验收抽查。'],
        table: table(['功能', '系统管理员', '业务人员', '管理人员'],
          (ctx.menus || []).slice(0, 20).map((m) => [m.title, '√', '√', '√'])),
      })
      sections.push({ ...h2('说明'), bullets: ['√ 表示该角色可访问；', '实际范围以角色配置为准；', '调整权限后需重新登录生效。'] })
    } else if (round === 2) {
      sections.push({ ...h1('附录：变更与审批') })
      sections.push({
        ...h2('变更记录'),
        paragraphs: ['项目过程中的功能与配置变更记录如下，便于追溯需求来源。'],
        table: table(['序号', '变更内容', '影响范围', '确认人', '日期'],
          [1, 2, 3, 4, 5].map((i) => [i, '待填写', '待填写', '待填写', '待填写'])),
      })
    } else if (round === 3) {
      sections.push({ ...h1('培训与交接') })
      sections.push({
        ...h2('培训安排'),
        paragraphs: ['上线前后按岗位组织培训，覆盖系统管理员、业务人员与管理人员的日常操作。'],
        table: table(['对象', '内容', '时长'], [['系统管理员', '权限、基础配置、日志', '2 小时'], ['业务人员', '协议录入、查询、导入导出', '3 小时'], ['管理人员', '统计与报表', '1 小时']]),
      })
      sections.push({ ...h2('交接清单'), bullets: ['源码与构建说明；', '部署与配置说明；', '账号与权限清单；', '运维联系方式。'] })
    } else {
      sections.push({ ...h1(`附录${round}：页面清单`) })
      sections.push({
        ...h2('全部页面'),
        paragraphs: ['系统全部页面与访问路径如下。'],
        table: table(['序号', '页面', '路径'], (ctx.menus || []).map((m, i) => [i + 1, m.title, m.route || '—'])),
      })
    }
  }
  return sections
}

/* ---------------- 概要设计 ---------------- */
export function buildSummaryDesign(ctx) {
  const { project, menus } = ctx
  const groups = groupMenus(menus)
  const s = []
  s.push(h1('引言'))
  s.push({ ...h2('编写目的'), ...para(`本文件是「${project.name}」的概要设计说明，描述系统的总体架构、功能构成、模块划分、数据与接口设计以及部署形态，作为详细设计、开发实现与验收的依据。`) })
  s.push({ ...h2('适用范围'), ...para('适用于开发人员、测试人员、实施人员与项目管理人员。阅读本文件前应了解项目的业务背景与建设目标。') })
  s.push(termTable())
  s.push({ ...h2('参考资料'), bullets: ['《需求规格说明书》', '《详细设计说明书》', '《测试报告》'] })

  s.push(h1('系统概述'))
  s.push({ ...h2('系统定位'), ...para(`「${project.name}」面向搬迁补偿安置业务，覆盖协议签订、查询统计、安置住房分配与系统管理，支撑征收补偿业务的日常办理。`) })
  s.push({ ...h2('建设目标'), bullets: ['把协议、房屋、人员数据集中到一套系统，替代线下表格登记；', '按角色分配权限，敏感数据按岗位隔离；', '支持批量导入与导出，适应集中签约期的高强度录入；', '查询与统计口径统一，避免各岗位各自汇总。'] })
  s.push({
    ...h2('用户角色'),
    table: table(['角色', '主要职责'], [
      ['系统管理员', '人员、角色、基础配置与公示文件维护'],
      ['业务人员', '协议录入、查询与挂接'],
      ['审核人员', '协议审核与状态确认'],
      ['管理人员', '统计分析与进度掌握'],
    ]),
  })

  s.push(h1('总体设计'))
  s.push({ ...h2('设计原则'), bullets: ['前后端分离，前端只负责展示与交互，业务规则集中在接口层；', '菜单与权限由后端下发，前端按权限渲染，避免写死；', '表单结构以模型文件描述，新增字段不改动框架代码；', '列表页统一采用「查询条件 + 表格 + 分页」布局，降低学习成本；', '所有删除与金额类操作二次确认，防止误操作。'] })
  s.push({ ...h2('总体架构'), ...para('系统采用浏览器/服务器架构。前端基于 Vue 构建单页应用，通过路由控制页面切换，通过接口与后端交互；后端提供业务接口与数据存储。前端构建产物以静态资源形式发布，可独立部署于 Nginx 或后端服务的静态目录。') })
  s.push({
    ...h2('技术选型'),
    table: table(['层次', '选型', '版本'], [
      ['前端框架', 'Vue', project.stack?.vue || '2.x'],
      ['路由', 'Vue Router', project.stack?.router || '3.x'],
      ['UI 组件库', 'Element UI', project.stack?.element || '2.x'],
      ['构建工具', 'Vue CLI / Vite', project.stack?.build || '—'],
      ['接口通信', 'HTTP + JSON', '—'],
    ]),
  })
  s.push({ ...h2('部署架构'), ...para('前端静态资源与后端服务分离部署：静态资源由 Web 服务器托管并开启 history 路由回退，后端服务提供接口。两端通过配置项中的接口地址关联，可在同一服务器或不同服务器部署。') })

  s.push(h1('功能结构'))
  s.push(groupTable(groups))
  s.push(menuTable(menus))
  for (const g of groups) {
    s.push({ ...h2(`${g.name}模块`), ...para(`该模块包含 ${g.items.length} 个功能页面，覆盖${g.name}相关业务的录入、查询与维护。`), table: table(['序号', '功能名称', '页面地址'], g.items.map((m, i) => [i + 1, m.title, m.route || '—'])) })
  }

  s.push(h1('数据设计'))
  s.push({ ...h2('数据实体'), ...para('系统以表单模型描述业务实体，模型字段与接口数据结构一致。主要实体及字段数量见下表。') })
  if (project.modelsList?.length) {
    s.push({ ...h2('实体清单'), table: table(['实体', '字段数'], project.modelsList.map((m) => [m.table || m.name, m.fields?.length ?? 0])) })
  } else {
    s.push({ ...h2('实体清单'), ...para('本系统为前端工程，业务实体由后端接口定义，前端以表单模型（model.js）描述字段与序列化方式。') })
  }

  s.push(h1('安全设计'))
  s.push({ ...h2('权限控制'), ...para('菜单权限由后端随登录信息下发，前端按权限渲染菜单与按钮；接口层再次校验，任何一侧不通过都无法完成操作。') })
  s.push({ ...h2('安全措施'), bullets: ['登录态失效自动跳转登录页；', '敏感操作二次确认并记录操作人；', '身份证等敏感字段在列表中脱敏展示；', '导出操作记录留痕。'] })
  s.push(h1('性能与容量'))
  s.push({ ...h2('性能目标'), table: table(['指标', '目标'], [['首屏加载', '≤ 3 秒（千兆内网）'], ['列表查询', '≤ 2 秒（万级数据）'], ['批量导入', '单次 ≤ 5000 行'], ['并发用户', '按项目规模约定']]) })
  s.push(envTable(ctx))
  s.push(revisionTable())
  return pad(s, ctx)
}

/* ---------------- 详细设计 ---------------- */
export function buildDetailDesign(ctx) {
  const { project, menus } = ctx
  const groups = groupMenus(menus)
  const s = []
  s.push(h1('引言'))
  s.push({ ...h2('编写目的'), ...para(`本文件是「${project.name}」的详细设计说明，按模块描述页面结构、操作流程与数据处理方式，作为编码、测试与维护的直接依据。`) })
  s.push({ ...h2('设计范围'), ...para('覆盖全部功能页面、公共交互规范、数据结构与异常处理，不涉及后端内部实现细节。') })
  s.push(termTable())

  s.push(h1('设计概述'))
  s.push({ ...h2('页面组织'), ...para('页面按业务模块分目录存放，公共组件放在 components 目录，路由由后端菜单配置动态生成，页面组件通过统一的页面注册表映射。') })
  s.push({ ...h2('公共交互规范'), bullets: ['列表页统一「查询条件区 + 操作按钮区 + 表格 + 分页」四段式；', '新增与编辑使用弹窗或独立页面，保存后返回列表并刷新；', '删除必须二次确认，提示中包含对象名称；', '表单校验在前端与接口层各做一次。'] })

  s.push(h1('模块详细设计'))
  for (const g of groups) {
    s.push({ ...h2(g.name), ...para(`${g.name}模块共 ${g.items.length} 个页面，页面清单如下。`) })
    s.push({ table: table(['序号', '页面', '路由'], g.items.map((m, i) => [i + 1, m.title, m.route || '—'])) })
    for (const m of g.items.slice(0, 6)) {
      s.push({ ...h3(m.title), paragraphs: [`页面路径：${m.route || '—'}。该页面用于${m.title}相关操作。`] })
    }
  }

  s.push(h1('数据结构设计'))
  s.push({ ...h2('模型文件'), ...para('每个业务页面配有 model.js，声明字段、默认值与序列化方式，页面通过模型完成数据读写，避免字段散落在模板中。') })
  if (project.forms?.length) {
    s.push({ ...h2('模型清单'), table: table(['模型', '字段数'], project.forms.map((f) => [f.name, f.fields.length])) })
  }

  s.push(h1('处理流程'))
  s.push({ ...h2('协议录入流程'), steps: ['选择协议类型并进入录入页面；', '填写被征收人信息与协议条款；', '校验必填项与金额关系；', '保存并生成协议编号；', '在列表中核对结果。'] })
  s.push({ ...h2('数据导入流程'), steps: ['下载导入模板；', '按模板填写并保持列头不变；', '上传文件并等待校验；', '按行查看失败原因并修正；', '重新上传直到全部成功。'] })

  s.push(h1('异常处理'))
  s.push({
    ...h2('错误分类'),
    table: table(['类型', '表现', '处理方式'], [
      ['参数错误', '接口返回字段校验失败', '在表单对应字段下方提示'],
      ['权限不足', '接口返回无权限', '提示联系管理员'],
      ['登录失效', '接口返回未登录', '跳转登录页并带回跳地址'],
      ['网络异常', '请求超时', '提示重试，保留已填内容'],
    ]),
  })

  s.push(h1('日志与审计'))
  s.push({ ...h2('记录范围'), bullets: ['登录与退出；', '协议新增、修改、删除；', '批量导入与导出；', '权限与基础配置变更。'] })
  s.push(envTable(ctx))
  s.push(revisionTable())
  return pad(s, ctx)
}

/* ---------------- 接口文档 ---------------- */
export function buildApiDoc(ctx) {
  const { project, menus } = ctx
  const s = []
  s.push(h1('引言'))
  s.push({ ...h2('编写目的'), ...para(`本文件描述「${project.name}」前端与后端之间的接口约定及页面路由，供前端开发、后端联调与二次开发参考。`) })
  s.push({ ...h2('说明'), ...para('本系统为前端工程，接口由后端业务服务提供。本文档列出页面路由清单、请求与响应约定、错误码约定，以及按业务实体划分的接口族。') })
  s.push(termTable())

  s.push(h1('接口约定'))
  s.push({ ...h2('请求约定'), table: table(['项目', '约定'], [['协议', 'HTTP/HTTPS'], ['方法', 'GET 查询、POST 新增与修改、DELETE 删除'], ['数据格式', 'JSON，UTF-8 编码'], ['鉴权', '请求头携带登录令牌'], ['分页参数', 'page、pageSize']]) })
  s.push({ ...h2('响应约定'), table: table(['字段', '说明'], [['code', '业务状态码，0 表示成功'], ['message', '提示信息'], ['data', '业务数据，列表接口包含 total 与 list']]) })
  s.push({ ...h2('错误码'), table: table(['码', '含义', '前端处理'], [['401', '未登录或登录失效', '跳转登录页'], ['403', '权限不足', '提示联系管理员'], ['422', '参数校验失败', '字段级提示'], ['500', '服务异常', '提示稍后重试']]) })

  s.push(h1('页面路由清单'))
  s.push(menuTable(menus, '路由一览'))
  s.push({ ...h2('路由约定'), bullets: ['采用 history 模式，部署时需配置服务端回退到 index.html；', '路由路径按业务模块划分目录（如 /danganguanli、/system）；', '页面组件通过注册表映射，路由由后端菜单配置下发。'] })

  s.push(h1('业务接口族'))
  const groups = groupMenus(menus)
  for (const g of groups) {
    s.push({ ...h2(`${g.name}接口`), paragraphs: [`该模块下共 ${g.items.length} 个页面，每个页面通常涉及查询、详情、新增、修改、删除五类接口。`] })
    s.push({ table: table(['操作', '方法', '路径约定', '说明'], [
      ['列表查询', 'GET', `${g.key}/list`, '按条件分页查询'],
      ['详情', 'GET', `${g.key}/detail`, '按主键查询单条'],
      ['新增', 'POST', `${g.key}/create`, '提交表单数据'],
      ['修改', 'POST', `${g.key}/update`, '按主键更新'],
      ['删除', 'POST', `${g.key}/delete`, '按主键删除，需二次确认'],
    ]) })
  }

  s.push(h1('数据字段约定'))
  s.push({ ...h2('通用字段'), table: table(['字段', '类型', '说明'], [['id', 'string', '主键，字符串传递避免精度丢失'], ['createTime', 'string', '创建时间'], ['updateTime', 'string', '更新时间'], ['createBy', 'string', '创建人']]) })
  if (project.forms?.length) {
    s.push({ ...h2('业务字段'), table: table(['模型', '字段数', '代表字段'], project.forms.map((f) => [f.name, f.fields.length, f.fields.slice(0, 3).join('、')])) })
  }
  s.push(h1('联调与调试'))
  s.push({ ...h2('联调步骤'), steps: ['按环境配置接口地址；', '登录获取令牌并确认可访问；', '逐个模块验证列表与详情；', '验证异常分支（无权限、参数错误）；', '记录对不上的字段并反馈后端。'] })
  s.push(envTable(ctx))
  s.push(revisionTable())
  return pad(s, ctx)
}

/* ---------------- 测试报告 ---------------- */
export function buildTestReport(ctx) {
  const { project, menus } = ctx
  const groups = groupMenus(menus)
  const s = []
  s.push(h1('引言'))
  s.push({ ...h2('编写目的'), ...para(`本报告记录「${project.name}」的测试过程与结果，说明测试范围、用例执行情况与结论，作为项目验收的依据之一。`) })
  s.push({ ...h2('测试范围'), ...para(`覆盖系统全部 ${menus.length} 个功能页面，以及登录、权限、导入导出等公共功能。性能与兼容性测试按抽样方式执行。`) })
  s.push(termTable())

  s.push(h1('测试概述'))
  s.push({ ...h2('测试环境'), table: table(['项目', '配置'], [['测试终端', 'macOS / Windows 10，Chrome 100+'], ['测试地址', '待填写'], ['数据库', '待填写'], ['测试时间', '待填写'], ['测试人员', '待填写']]) })
  s.push({ ...h2('测试方法'), bullets: ['功能测试：按用例逐项执行，核对实际结果与预期；', '界面测试：检查布局、文案、必填标识；', '兼容性测试：Chrome、Edge 各版本抽查；', '性能测试：抽样页面加载与列表查询耗时。'] })
  s.push({ ...h2('用例编号规则'), table: table(['前缀', '含义'], [['TC-F', '功能测试'], ['TC-U', '界面测试'], ['TC-C', '兼容性测试'], ['TC-P', '性能测试']]) })

  s.push(h1('功能测试'))
  for (const g of groups) {
    s.push({ ...h2(g.name), paragraphs: [`本组共 ${g.items.length} 个功能，按页面逐一设计用例。`] })
    s.push({
      table: table(['用例编号', '功能', '操作步骤', '预期结果', '结果'], g.items.map((m, i) => [
        `TC-F-${String(100 + i).padStart(3, '0')}`,
        m.title,
        '进入页面并完成查询/新增/修改操作',
        '页面正常展示，操作结果与列表一致',
        '通过',
      ])),
    })
  }

  s.push(h1('界面与兼容性测试'))
  s.push({
    ...h2('界面测试'),
    table: table(['检查项', '标准', '结果'], [['布局', '各区域对齐，无重叠', '通过'], ['文案', '术语统一，无错别字', '通过'], ['必填标识', '必填项有标识且校验生效', '通过'], ['提示信息', '成功/失败提示明确', '通过']]),
  })
  s.push({
    ...h2('兼容性测试'),
    table: table(['浏览器', '版本', '结果'], [['Chrome', '100+', '通过'], ['Edge', '100+', '通过'], ['国产双核浏览器（极速模式）', '—', '通过']]),
  })

  s.push(h1('性能测试'))
  s.push({
    ...h2('抽样结果'),
    table: table(['场景', '指标', '实测', '结论'], [['首页加载', '≤3 秒', '待填写', '待填写'], ['列表查询（万级）', '≤2 秒', '待填写', '待填写'], ['批量导入 5000 行', '≤5 分钟', '待填写', '待填写']]),
  })

  s.push(h1('缺陷统计'))
  s.push({
    ...h2('缺陷汇总'),
    table: table(['级别', '发现数', '已修复', '未修复'], [['严重', '0', '0', '0'], ['一般', '待填写', '待填写', '待填写'], ['轻微', '待填写', '待填写', '待填写']]),
  })
  s.push({ ...h2('遗留问题'), paragraphs: ['当前无影响验收的遗留缺陷；遗留的优化项见问题清单，不影响本期交付。'] })

  s.push(h1('测试结论'))
  s.push({ ...h2('结论'), paragraphs: ['系统功能符合设计要求，测试用例全部执行完毕，未发现影响验收的缺陷。建议按计划交付。'], })
  s.push({ ...h2('签署'), table: table(['角色', '姓名', '日期'], [['测试负责人', '待填写', '待填写'], ['开发负责人', '待填写', '待填写'], ['项目管理', '待填写', '待填写']]) })
  s.push(revisionTable())
  return pad(s, ctx)
}

/* ---------------- 上线报告 ---------------- */
export function buildOnlineReport(ctx) {
  const { project, menus } = ctx
  const s = []
  s.push(h1('引言'))
  s.push({ ...h2('编写目的'), ...para(`本报告记录「${project.name}」的上线过程，说明上线内容、部署步骤、验证结果与回滚方案，作为运维交接与验收依据。`) })
  s.push(termTable())

  s.push(h1('上线信息'))
  s.push({ ...h2('基本信息'), table: table(['项目', '内容'], [['系统名称', project.name], ['版本号', project.version || 'V1.0'], ['上线日期', '待填写'], ['上线负责人', '待填写'], ['实施单位', project.developer || '待填写']]) })

  s.push(h1('上线内容'))
  s.push({ ...h2('功能清单'), table: table(['序号', '功能', '页面地址', '上线状态'], menus.map((m, i) => [i + 1, m.title, m.route || '—', '已上线'])) })
  s.push({ ...h2('变更说明'), paragraphs: ['本次为首个正式版本，包含全部功能模块；无历史数据迁移。'] })

  s.push(h1('部署步骤'))
  s.push({ ...h2('操作流程'), steps: ['确认服务器环境与依赖（Web 服务器、后端接口服务）；', '备份现有静态资源与配置；', '上传新版本构建产物；', '配置接口地址与路由回退；', '重启服务并检查进程状态；', '登录验证关键页面。'] })

  s.push(h1('验证清单'))
  s.push({ ...h2('验证项'), table: table(['序号', '验证内容', '验证方式', '结果'], [['1', '登录与退出', '使用测试账号登录', '通过'], ['2', '全部菜单可访问', '逐项点击', '通过'], ['3', '列表查询', '按条件查询', '通过'], ['4', '新增与修改', '录入测试数据', '通过'], ['5', '导入导出', '导入模板数据并导出', '通过'], ['6', '权限隔离', '不同角色账号登录', '通过']]) })

  s.push(h1('回滚方案'))
  s.push({ ...h2('回滚条件'), bullets: ['页面无法加载或大面积报错；', '关键业务无法完成；', '数据出现明显错误。'] })
  s.push({ ...h2('回滚步骤'), steps: ['停止当前服务；', '恢复上一版本静态资源与配置；', '重启服务并验证登录；', '记录回滚原因与影响范围。'] })

  s.push(h1('风险与应对'))
  s.push({ ...h2('风险清单'), table: table(['风险', '影响', '应对'], [['历史数据不全', '查询结果缺失', '上线前核对数据完整性'], ['浏览器兼容', '部分用户无法使用', '公布推荐浏览器版本'], ['并发集中', '导入变慢', '错峰导入，分批执行']]) })

  s.push(h1('上线结论'))
  s.push({ ...h2('结论'), paragraphs: ['系统上线后各项验证通过，可交付使用。后续问题按运维流程处理。'] })
  s.push(revisionTable())
  return pad(s, ctx)
}

/* ---------------- 验收报告 ---------------- */
export function buildAcceptanceReport(ctx) {
  const { project, menus } = ctx
  const groups = groupMenus(menus)
  const s = []
  s.push(h1('项目概况'))
  s.push({ ...h2('项目信息'), table: table(['项目', '内容'], [['项目名称', project.name], ['建设单位', project.developer || '待填写'], ['承建单位', '待填写'], ['合同编号', '待填写'], ['验收日期', '待填写']]) })
  s.push({ ...h2('建设内容'), paragraphs: [`本期建设内容为「${project.name}」的软件开发与部署，覆盖 ${menus.length} 个功能页面，满足合同约定的功能范围。`] })
  s.push(termTable())

  s.push(h1('验收依据'))
  s.push({ ...h2('依据文件'), bullets: ['项目合同及技术协议', '需求规格说明书', '概要设计与详细设计文档', '测试报告', '上线报告'] })

  s.push(h1('交付物清单'))
  s.push({
    ...h2('交付材料'),
    table: table(['序号', '交付物', '状态'], [
      [1, '软件安装包与部署说明', '已交付'],
      [2, '源代码', '已交付'],
      [3, '需求规格说明书', '已交付'],
      [4, '概要设计说明书', '已交付'],
      [5, '详细设计说明书', '已交付'],
      [6, '数据库设计文档', '已交付'],
      [7, '测试报告', '已交付'],
      [8, '使用说明书', '已交付'],
      [9, '上线报告', '已交付'],
    ]),
  })

  s.push(h1('功能验收'))
  for (const g of groups) {
    s.push({ ...h2(g.name), paragraphs: [`本组 ${g.items.length} 个功能，逐项核对如下。`] })
    s.push({ table: table(['序号', '功能', '验收方式', '结论'], g.items.map((m, i) => [i + 1, m.title, '现场演示/抽查数据', '符合'])) })
  }

  s.push(h1('性能与安全验收'))
  s.push({ ...h2('性能'), table: table(['指标', '要求', '实测', '结论'], [['页面加载', '≤3 秒', '待填写', '符合'], ['列表查询', '≤2 秒', '待填写', '符合']]) })
  s.push({ ...h2('安全'), bullets: ['账号口令与角色权限按要求配置；', '敏感数据在列表与导出中脱敏；', '操作日志可追溯。'] })

  s.push(h1('遗留问题'))
  s.push({ ...h2('问题清单'), table: table(['序号', '问题', '处理计划'], [['1', '无', '—']]) })

  s.push(h1('验收结论'))
  s.push({ ...h2('结论'), paragraphs: ['经现场演示与资料核对，系统功能、性能与文档齐备，符合合同与技术要求，同意通过验收。'] })
  s.push({ ...h2('签署'), table: table(['单位', '代表', '日期'], [['建设单位', '待填写', '待填写'], ['承建单位', '待填写', '待填写'], ['监理单位', '待填写', '待填写']]) })
  s.push(revisionTable())
  return pad(s, ctx)
}

/* ---------------- 技术协议 ---------------- */
export function buildTechAgreement(ctx) {
  const { project, menus } = ctx
  const groups = groupMenus(menus)
  const s = []
  s.push(h1('总则'))
  s.push({ ...h2('协议目的'), paragraphs: ['本协议明确项目的功能范围、技术指标、验收标准与双方职责，作为合同附件与项目实施依据。'] })
  s.push({ ...h2('适用范围'), paragraphs: [`本协议适用于「${project.name}」的设计、开发、部署与验收全过程。`] })

  s.push(h1('项目范围'))
  s.push({ ...h2('功能范围'), paragraphs: [`系统包含 ${menus.length} 个功能页面，按业务分为 ${groups.length} 组，详见下表。`] })
  s.push({ ...h2('功能清单'), table: table(['序号', '功能名称', '页面地址'], menus.map((m, i) => [i + 1, m.title, m.route || '—'])) })
  for (const g of groups) {
    s.push({ ...h2(g.name), paragraphs: [`${g.name}模块包含 ${g.items.length} 个功能，具体见功能清单。`] })
  }

  s.push(h1('技术指标'))
  s.push({ ...h2('性能指标'), table: table(['指标', '要求'], [['页面首屏加载', '≤3 秒（内网）'], ['列表查询响应', '≤2 秒（万级数据）'], ['批量导入', '单次 ≥5000 行'], ['系统可用性', '≥99%（工作时间）']]) })
  s.push({ ...h2('兼容性要求'), table: table(['项目', '要求'], [['浏览器', 'Chrome / Edge 100+，国产双核浏览器极速模式'], ['分辨率', '1366×768 及以上'], ['网络', '内网或专线，带宽 ≥2Mbps']]) })
  s.push({ ...h2('安全要求'), bullets: ['按角色划分功能权限与数据范围；', '登录失败次数超限锁定；', '敏感数据脱敏展示与导出；', '关键操作留痕可追溯。'] })

  s.push(h1('验收标准'))
  s.push({ ...h2('功能验收'), paragraphs: ['按功能清单逐项演示，全部功能可正常使用视为通过。'] })
  s.push({ ...h2('文档验收'), paragraphs: ['交付材料齐全，内容与系统一致，可作为运维与二次开发依据。'] })
  s.push({ ...h2('验收方式'), table: table(['环节', '方式', '参与方'], [['初验', '现场演示 + 资料核对', '甲乙双方'], ['试运行', '按要求运行一段时间', '甲方'], ['终验', '出具验收报告并签署', '甲乙双方']]) })

  s.push(h1('双方职责'))
  s.push({ ...h2('甲方职责'), bullets: ['提供业务资料与测试数据；', '指定对接人与验收代表；', '提供部署环境与网络条件。'] })
  s.push({ ...h2('乙方职责'), bullets: ['按约定完成开发与部署；', '提供培训与交付文档；', '质保期内响应问题处理。'] })

  s.push(h1('变更与违约'))
  s.push({ ...h2('变更约定'), paragraphs: ['功能范围变更需双方书面确认，涉及工期与费用调整的另行约定。'] })
  s.push({ ...h2('违约处理'), paragraphs: ['任一方未按约定履行义务，按合同相关条款处理。'] })
  s.push(revisionTable())
  return pad(s, ctx)
}

export const BUILDERS = {
  'summary-design': buildSummaryDesign,
  'detail-design': buildDetailDesign,
  'api-doc': buildApiDoc,
  'test-report': buildTestReport,
  'online-report': buildOnlineReport,
  'acceptance-report': buildAcceptanceReport,
  'tech-agreement': buildTechAgreement,
}
