/**
 * 使用说明书：按模块生成操作章节。
 * 有截图就插图，没截图就留空位并提示补图——不拿假图充数。
 */
export function buildUserManualDoc({ project, screens }) {
  const byTitle = new Map((screens || []).map((s) => [s.title, s.png]))
  const sections = []
  const modules = project.modulesList || []

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
      steps: m.steps && m.steps.length ? m.steps : [
        `在左侧菜单进入「${name}」；`,
        '按页面提示填写或选择条件；',
        '提交后可在列表中查看结果。',
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
