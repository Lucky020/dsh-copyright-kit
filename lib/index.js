/**
 * dsh-copyright-kit — 软著工坊
 *
 * 把「一个代码仓库 + 一个软件名」变成软件著作权登记要交的材料。
 * 当前版本（P0）负责两份最机械、最容易出错的文档：
 *   1) 源程序鉴别材料：前后各 30 页、每页 50 行、页眉带软件名与版本号、右上角页码
 *   2) 软件说明书：结构化作答的合规排版（自动编号、图片图注、表格）
 *
 * 纯 server 端工具型插件，不依赖 client 端与任何 @deepseek-ai/* 运行时包。
 */
import { toolFactories } from './tools.js'

export const name = 'dsh-copyright-kit'

export const inject = ['tools']

export function apply(ctx) {
  for (const factory of toolFactories) {
    ctx.effect(
      () => ctx.tools.register(factory()),
      `dsh-copyright-kit: ${factory.name}`,
    )
  }
}
