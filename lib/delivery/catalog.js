/**
 * 交付文档目录：告诉用户「能生成哪些、每份要什么材料、哪些能从代码自动得到」。
 *
 * 生成原则：缺材料不猜，直接列进 missing 让 agent 去问用户。
 */
export const DOC_CATALOG = [
  {
    id: 'database',
    name: '数据库设计说明书',
    auto: 0.95,
    need: [],
    optional: ['每张表的业务含义'],
    source: '扫描 ORM 模型与字段类型',
    note: '完全可从代码生成；表说明留空处标注待补充',
  },
  {
    id: 'summary-design',
    name: '概要设计说明书',
    auto: 0.7,
    need: [],
    optional: ['架构决策说明', '部署拓扑', '容量规划'],
    source: '技术栈、模块目录、依赖清单',
    note: '模块划分与分层从代码推导，架构取舍需人工补',
  },
  {
    id: 'detail-design',
    name: '详细设计说明书',
    auto: 0.6,
    need: [],
    optional: ['关键流程说明', '算法与规则'],
    source: '接口清单、数据表、模块目录',
    note: '按模块列出接口与数据结构',
  },
  {
    id: 'api-doc',
    name: '接口文档',
    auto: 0.75,
    need: [],
    optional: ['接口用途补充说明'],
    source: '路由注解、请求方法、路径',
    note: '路径与函数名来自代码，参数说明需人工补',
  },
  {
    id: 'test-report',
    name: '测试报告',
    auto: 0.3,
    need: ['测试环境信息', '测试结论（通过/不通过）'],
    optional: ['真实测试用例与执行记录'],
    source: '接口清单生成接口测试项',
    note: '按接口生成测试项，结果需人工填写或提供执行记录',
  },
  {
    id: 'online-report',
    name: '上线报告',
    auto: 0.3,
    need: ['上线时间', '上线内容清单', '参与人员'],
    optional: ['回滚方案', '验证记录'],
    source: 'git 提交记录、部署文档',
    note: '上线内容可从 git 提交提取，其余需人工填',
  },
  {
    id: 'acceptance-report',
    name: '验收报告',
    auto: 0.4,
    need: ['甲方单位全称', '合同编号', '验收日期', '验收结论'],
    optional: ['验收组成员'],
    source: '汇总测试报告与功能清单',
    note: '结论与签认信息只能由人提供',
  },
  {
    id: 'tech-agreement',
    name: '技术协议',
    auto: 0.1,
    need: ['合同约定的功能范围', '性能指标', '验收标准'],
    optional: ['甲方特殊要求'],
    source: '—',
    note: '没有合同附件时按项目实际能力写，需人工确认',
  },
  {
    id: 'user-manual',
    name: '使用说明书',
    auto: 0.5,
    need: ['界面截图'],
    optional: ['操作注意事项'],
    source: '菜单结构、功能清单',
    note: '按菜单生成操作章节，插图需提供截图',
  },
]

export function catalogPayload(project) {
  return {
    docs: DOC_CATALOG.map((d) => ({
      id: d.id,
      name: d.name,
      auto_ratio: d.auto,
      required: d.need,
      optional: d.optional,
    })),
    project: project
      ? {
          name: project.name || '',
          tables: project.tables ?? 0,
          routes: project.routes ?? 0,
          modules: project.modules ?? 0,
          missing: project.missing ?? [],
        }
      : null,
  }
}
