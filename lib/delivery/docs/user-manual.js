/**
 * 使用说明书：按模块生成操作章节。
 * 有截图就插图，没截图就留空位并提示补图——不拿假图充数。
 */
const STEP_TEMPLATES = [
  [/查询/, ['进入页面，按需填写被征收人、身份证号、协议编号等查询条件；', '点击「搜索」获取结果；', '在列表中查看协议明细，可点击操作列的图标查看或编辑；', '需要汇总时点击「Excel 导出」下载当前结果。']],
  [/统计/, ['进入统计页面，选择统计维度与时间范围；', '点击查询生成统计结果；', '核对统计口径与明细是否一致；', '需要留档时导出表格。']],
  [/导入/, ['下载导入模板；', '按模板填写数据，保持列头不变；', '选择文件并上传；', '在导入结果中查看成功与失败的条目，失败项按提示修正后重传。']],
  [/挂接/, ['选择待挂接的协议或对象；', '选择需要关联的目标数据；', '确认关联关系后保存；', '在列表中核对挂接结果。']],
  [/配置/, ['进入配置页面，选择需要维护的配置项；', '按业务规则修改取值；', '保存后配置对相关页面立即生效；', '如需回退，按原值改回。']],
  [/管理/, ['进入管理页面查看现有数据；', '按需新增、编辑或停用；', '操作后确认列表状态与权限一致。']],
]

function stepsFor(title) {
  for (const [re, steps] of STEP_TEMPLATES) if (re.test(title)) return steps
  return ['进入页面查看当前数据；', '按页面提示完成操作；', '提交后确认结果。']
}

export function buildUserManualDoc({ project, screens }) {
  const byTitle = new Map((screens || []).map((s) => [s.title, s.png]))
  const sections = []
  // 有截图时，菜单即模块（截图标题就是菜单名）；否则退回代码里推的模块
  const modules = (project.modulesList && project.modulesList.length)
    ? project.modulesList
    : (screens || []).map((s) => ({ name: s.title, desc: '', steps: [] }))

  sections.push({ heading: '引言', level: 1 })
  sections.push({
    heading: '编写目的',
    level: 2,
    paragraphs: [
      `本说明书面向「${project.name}」的使用人员，说明系统各功能模块的用途与操作步骤，作为培训、日常使用与验收的依据。`,
    ],
  })
  sections.push({
    heading: '读者对象',
    level: 2,
    bullets: [
      '系统管理员：负责账号、角色与基础数据维护；',
      '业务操作人员：使用系统完成日常工作；',
      '运维人员：负责运行环境与数据备份。',
    ],
  })
  sections.push({ heading: '运行环境', level: 1 })
  sections.push({
    heading: '客户端要求',
    level: 2,
    table: {
      header: ['项目', '要求'],
      rows: [
        ['浏览器', 'Chrome 100+ / Edge 100+（建议使用最新版）'],
        ['分辨率', '建议 1366×768 及以上'],
        ['网络', '可访问系统服务地址'],
      ],
    },
  })

  sections.push({ heading: '功能结构', level: 1 })
  sections.push({
    heading: '功能分组',
    level: 2,
    paragraphs: ['系统按业务分为若干功能组，左侧菜单与下述分组一一对应。'],
    table: {
      header: ['功能组', '包含功能数', '说明'],
      rows: (() => {
        const groups = new Map()
        for (const sc of screens || []) {
          const seg = (sc.route || '').split('/').filter(Boolean)[0] || '其他'
          groups.set(seg, (groups.get(seg) || 0) + 1)
        }
        const NAME = {
          danganguanli: '档案管理（新建协议与数据录入）',
          chaxuntongji: '查询统计（协议查询与汇总）',
          anzhizhufang: '安置住房（房屋基础信息与分配）',
          system: '系统管理（人员、角色、基础配置）',
          login: '登录',
          dashboard: '首页',
        }
        return [...groups.entries()].map(([k, n]) => [NAME[k] || k, String(n), k])
      })(),
    },
  })

  sections.push({ heading: '功能操作说明', level: 1 })
  sections.push({
    heading: '本章说明',
    level: 2,
    paragraphs: ['按左侧菜单顺序说明各模块的用途与操作路径；截图对应系统实际界面。'],
  })

  for (const m of modules) {
    const name = m.name
    const img = byTitle.get(name)
    const sec = {
      heading: name,
      level: 2,
      paragraphs: [m.desc || `${name}模块用于完成相关业务操作。`],
      steps: (m.steps && m.steps.length) ? m.steps : [
        `在左侧菜单进入「${name}」；`,
        ...stepsFor(name),
      ],
    }
    if (img) {
      sec.image = img
      sec.caption = `${name}页面`
    } else {
      sec.paragraphs.push('（此处应插入该模块的界面截图，待补充。）')
    }
    sections.push(sec)
  }

  if (screens && screens.length) {
    sections.push({ heading: '附录：菜单与页面清单', level: 1 })
    sections.push({
      heading: '功能入口一览',
      level: 2,
      paragraphs: ['下表列出系统全部功能入口及对应页面地址，便于培训与日常查找。'],
      table: {
        header: ['序号', '功能名称', '页面地址'],
        rows: screens.map((s, i) => [String(i + 1), s.title, s.route || '—']),
      },
    })
  }

  sections.push({ heading: '术语与修订', level: 1 })
  sections.push({
    heading: '术语说明',
    level: 2,
    table: {
      header: ['术语', '说明'],
      rows: [
        ['协议', '征收方与被征收方签订的补偿协议，分安置住房、土地、养老三类'],
        ['挂接', '把协议与房屋、对象等数据建立关联关系'],
        ['导入', '按模板批量录入数据'],
        ['公示文件', '面向被征收人公开的文件材料'],
        ['流程', '业务审批与办理的流转顺序'],
        ['乡镇地区', '按行政区域划分的管理范围'],
        ['户型/平米配置', '安置住房的房型与面积基准配置'],
      ],
    },
  })
  sections.push({
    heading: '文档修订记录',
    level: 2,
    table: {
      header: ['版本', '日期', '说明'],
      rows: [
        ['V1.0', '—', '首次编写'],
      ],
    },
  })

  sections.push({ heading: '权限与角色', level: 1 })
  sections.push({
    heading: '角色说明',
    level: 2,
    paragraphs: [
      '系统按角色分配菜单与操作权限，角色在「系统管理 → 角色管理」中维护。人员归属角色后，登录时按角色加载可见菜单。',
      '不同角色看到的菜单范围不同：业务人员看到与自己工作相关的协议与查询；管理人员额外看到配置与统计页面；系统管理员可维护人员、角色与基础数据。',
    ],
    bullets: [
      '新增人员后需分配角色，否则登录后无可用菜单；',
      '角色调整在下次登录或刷新后生效；',
      '停用的人员无法登录，历史数据保留；',
      '涉及金额与协议删除的操作仅对管理员开放。',
    ],
  })
  sections.push({
    heading: '账号安全',
    level: 2,
    paragraphs: [
      '首次登录后应修改初始密码；密码需满足长度与复杂度要求。连续多次输错密码会触发临时锁定，需联系管理员解锁。长时间无操作时系统自动退出登录。',
    ],
  })

  sections.push({ heading: '数据维护', level: 1 })
  sections.push({
    heading: '日常数据维护',
    level: 2,
    paragraphs: [
      '协议、房屋与人员数据由各岗位按职责录入，系统不做跨岗位代录。数据修改保留操作记录，可通过系统管理中的操作日志追溯。',
      '批量数据通过导入功能录入，导入前应先在测试环境验证模板格式；导入失败会逐行提示原因，修正后重新上传即可，不会部分写入。',
    ],
    bullets: [
      '每月核对一次协议数量与财务收款是否一致；',
      '人员离职后及时停用账号，避免越权访问；',
      '重要数据变更前先导出留档。',
    ],
  })
  sections.push({
    heading: '备份与恢复',
    level: 2,
    paragraphs: [
      '数据库由运维按日备份，重要节点（如集中签约期）可临时增加备份频次。恢复操作由运维执行，恢复后需核对最近一日的数据完整性。',
    ],
  })

  sections.push({ heading: '常见问题', level: 1 })
  sections.push({
    heading: '使用类问题',
    level: 2,
    bullets: [
      '登录后看不到某菜单：请联系管理员确认角色权限；',
      '页面数据不刷新：使用页面刷新按钮重新获取；',
      '提交失败：按提示检查必填项与格式要求。',
    ],
  })

  return sections
}
