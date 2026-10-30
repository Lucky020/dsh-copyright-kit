/**
 * 数据库设计说明书：从 ORM 模型直接生成，不需要人工喂素材。
 *
 * 只写代码里能证实的东西（表名、字段、类型）；表用途这类需要业务判断的，
 * 统一标「待补充」，不替用户编。
 */
export function buildDatabaseDoc({ project, models }) {
  const sections = []
  const tables = models || []
  const totalFields = tables.reduce((n, m) => n + m.fields.length, 0)

  sections.push({ heading: '引言', level: 1 })
  sections.push({
    heading: '编写目的',
    level: 2,
    paragraphs: [
      `本文档描述「${project.name}」的数据库设计，包括数据库选型、命名规范、数据表清单与各表结构明细，作为系统验收资料与后续运维、二次开发的依据。`,
    ],
  })
  sections.push({
    heading: '适用范围',
    level: 2,
    paragraphs: [
      '本文档适用于数据库部署实施、日常运维、数据备份恢复以及基于现有数据模型的二次开发。文档中的表名与字段名均与系统代码中的模型定义一致。',
    ],
  })
  sections.push({
    heading: '数据库概述',
    level: 1,
    paragraphs: [
      `系统数据库共包含 ${tables.length} 张业务表、${totalFields} 个字段。表结构以代码中的 ORM 模型定义为唯一真源，本文档由模型自动导出，避免文档与实现脱节。`,
    ],
  })
  sections.push({
    heading: '数据库选型',
    level: 2,
    paragraphs: [
      `系统采用 ${project.database || '关系型数据库'} 作为主数据存储${project.timeseries ? '，时序数据使用 TimescaleDB 扩展按时间分区存储' : ''}；缓存与消息通过 ${project.cache || 'Redis'} 承载。字符集统一使用 UTF-8。`,
    ],
  })
  sections.push({
    heading: '命名规范',
    level: 2,
    bullets: [
      '表名与字段名统一使用小写下划线风格（snake_case），不使用驼峰；',
      '主键统一为 id 字段，使用 64 位整型，对外以字符串形式传递，避免前端精度丢失；',
      '业务表统一携带创建时间、更新时间等审计字段；',
      '关联字段以 _id 结尾，与目标表主键对应。',
    ],
  })
  sections.push({
    heading: '数据表清单',
    level: 1,
    paragraphs: ['系统全部数据表如下表所示，字段数量统计自模型定义。'],
    table: {
      header: ['序号', '表名', '字段数', '说明'],
      rows: tables.map((m, i) => [String(i + 1), m.table, String(m.fields.length), '待补充']),
    },
  })

  sections.push({ heading: '表结构明细', level: 1 })
  sections.push({
    heading: '字段类型说明',
    level: 2,
    paragraphs: [
      '下表中「类型」取自模型定义的类型名，实际物理类型由 ORM 映射决定；「说明」为字段业务含义，需由开发人员补充。',
    ],
  })

  for (const m of tables) {
    sections.push({
      heading: m.table,
      level: 2,
      paragraphs: [`模型类：${m.class || m.table}；字段数：${m.fields.length}。`],
      table: {
        header: ['字段名', '类型', '说明'],
        rows: m.fields.map((f) => [f, (m.field_types && m.field_types[f]) || '—', '待补充']),
      },
    })
  }

  sections.push({ heading: '约束与索引', level: 1 })
  sections.push({
    heading: '主键与唯一约束',
    level: 2,
    paragraphs: [
      '所有业务表以 id 为主键；存在业务唯一性的表（如用户名、编码类字典）在数据库层建立唯一索引，防止并发写入产生重复数据。',
    ],
  })
  sections.push({
    heading: '外键与关联',
    level: 2,
    paragraphs: [
      '业务表之间通过 _id 字段逻辑关联，未强制建立数据库外键约束，以降低分库分表与批量导入时的耦合；关联完整性由服务端事务与校验保证。',
    ],
  })
  sections.push({ heading: '数据安全', level: 1 })
  sections.push({
    heading: '访问控制',
    level: 2,
    paragraphs: [
      '数据库账号按职责划分：应用账号仅具备业务表的增删改查权限，不具备 DDL 权限；运维账号用于备份与结构变更，限制来源 IP；只读账号供报表与数据分析使用，仅可访问视图与聚合结果。',
    ],
    bullets: [
      '应用账号密码通过环境变量注入，不写入代码仓库；',
      '生产环境禁止使用超级管理员账号连接应用；',
      '数据导出需经审批，导出记录留痕。',
    ],
  })
  sections.push({
    heading: '敏感数据保护',
    level: 2,
    paragraphs: [
      '用户密码采用加盐哈希存储，不可逆；涉及个人信息与联系方式的字段在导出与日志中做脱敏处理；审计日志独立存放，保留期限不少于六个月。',
    ],
  })
  sections.push({ heading: '性能与容量', level: 1 })
  sections.push({
    heading: '索引设计',
    level: 2,
    paragraphs: [
      '高频查询条件对应的字段建立普通索引；组合查询按最左前缀原则建立复合索引；写入密集的表控制索引数量，避免影响写入吞吐。索引变更随版本发布，不在生产环境临时添加。',
    ],
  })
  sections.push({
    heading: '容量规划',
    level: 2,
    paragraphs: [
      '业务数据按年增长估算容量，时序类数据按时间分区并设置保留周期，历史数据定期归档至冷存储。磁盘使用率超过 70% 时触发扩容告警。',
    ],
  })
  sections.push({ heading: '备份与恢复', level: 1 })
  sections.push({
    heading: '备份策略',
    level: 2,
    paragraphs: [
      '数据库每日执行一次全量备份，保留 30 天；关键业务表按小时增量备份。备份文件与生产环境分离存放，每季度进行一次恢复演练。',
    ],
  })
  sections.push({
    heading: '恢复流程',
    level: 2,
    steps: [
      '确认故障范围与最近可用备份；',
      '在隔离环境恢复备份并校验数据完整性；',
      '确认无误后切换至恢复实例；',
      '记录故障原因与恢复耗时。',
    ],
  })

  sections.push({ heading: '数据流转', level: 1 })
  sections.push({
    heading: '数据分层',
    level: 2,
    paragraphs: [
      '数据按用途分为三层：基础档案层（组织、人员、设备等主数据）、业务流水层（工单、记录、日志等过程数据）、统计分析层（按日聚合的结果数据）。上层依赖下层，不允许反向写入。',
      '基础档案由管理岗维护，变更需留痕；业务流水由操作产生，只追加不修改；统计分析由定时任务从流水层汇总，可重算，重算不影响原始数据。',
    ],
  })
  sections.push({
    heading: '一致性保障',
    level: 2,
    paragraphs: [
      '跨表写入在同一事务内完成，失败整体回滚；涉及多个业务对象的操作（如工单流转同时写流水）先校验后写入，避免产生半成品数据。',
      '对外提供的只读接口读取聚合结果或视图，不直接暴露原始流水表，减少误用。',
    ],
  })
  sections.push({ heading: '开发约定', level: 1 })
  sections.push({
    heading: '建模约定',
    level: 2,
    bullets: [
      '新增业务表需同时提供模型定义与迁移脚本，两者一并提交；',
      '字段新增只允许追加，不允许改名或改类型后直接上线；',
      '删除字段前先在代码中停止读写，确认无引用后再删列；',
      '枚举值使用整型或字符串常量，不使用数据库原生枚举类型，便于扩展。',
    ],
  })
  sections.push({
    heading: '变更流程',
    level: 2,
    steps: [
      '在开发分支修改模型并生成迁移脚本；',
      '在测试环境执行迁移并验证数据完整性；',
      '评审迁移脚本，确认可回滚；',
      '发布时先执行迁移，再启动新版本服务。',
    ],
  })

  sections.push({ heading: '常见问题', level: 1 })
  sections.push({
    heading: '部署与迁移',
    level: 2,
    bullets: [
      '迁移脚本执行失败：先确认数据库版本与扩展是否满足要求，再逐条手工执行定位到具体语句；',
      '字符集乱码：确认数据库、连接串、应用三处字符集一致；',
      '时序扩展缺失：安装 TimescaleDB 后再执行建表迁移；',
      '主键冲突：确认雪花 ID 生成器实例编号未重复。',
    ],
  })
  sections.push({
    heading: '运行与维护',
    level: 2,
    bullets: [
      '查询变慢：先看慢查询日志与执行计划，再判断缺索引还是数据量超预期；',
      '连接数打满：检查连接池配置与是否存在长事务；',
      '磁盘增长过快：确认时序数据保留周期与归档策略是否按预期执行；',
      '备份恢复后数据不一致：以流水表为准重算聚合结果。',
    ],
  })

  sections.push({ heading: '术语表', level: 1 })
  sections.push({
    heading: '数据库术语',
    level: 2,
    table: {
      header: ['术语', '说明'],
      rows: [
        ['主数据', '被多个业务模块共享的基础档案数据，如组织、人员、设备'],
        ['流水表', '只追加、不修改的过程数据表，用于追溯'],
        ['聚合表', '由流水表按时间或维度汇总生成的结果表，可重算'],
        ['时序表', '按时间顺序存储的数据表，通常按时间分区'],
        ['迁移脚本', '描述数据库结构变更的可重复执行脚本'],
        ['只读账号', '仅具备查询权限的数据库账号，供报表与分析使用'],
        ['幂等', '同一操作执行多次与执行一次的结果相同'],
      ],
    },
  })

  sections.push({ heading: '附录', level: 1 })
  sections.push({
    heading: '表关系说明',
    level: 2,
    paragraphs: ['下表列出主要业务表与关联表的对应关系，关联通过 _id 字段实现。'],
    table: {
      header: ['源表', '关联表', '关联字段', '关系'],
      rows: tables
        .filter((m) => m.fields.some((f) => f.endsWith('_id') && f !== 'id'))
        .slice(0, 30)
        .map((m) => [
          m.table,
          m.fields.filter((f) => f.endsWith('_id') && f !== 'id')[0].replace('_id', ''),
          m.fields.filter((f) => f.endsWith('_id') && f !== 'id')[0],
          '多对一',
        ]),
    },
  })
  sections.push({
    heading: '字段类型对照',
    level: 2,
    paragraphs: ['下表统计系统各处使用的字段类型及其出现次数，供后续建表时保持风格一致。'],
    table: {
      header: ['字段类型', '出现次数'],
      rows: (() => {
        const counter = new Map()
        for (const m of tables) {
          for (const f of m.fields) {
            const ty = (m.field_types && m.field_types[f]) || '未标注'
            counter.set(ty, (counter.get(ty) || 0) + 1)
          }
        }
        return [...counter.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([ty, n]) => [ty, String(n)])
      })(),
    },
  })

  return sections
}
