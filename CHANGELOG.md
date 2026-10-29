# Changelog

## 0.2.0 — 2026-10-29

### Added
- `copyright_screens`：按 spec 渲染同一套壳下多张 B2B 控制台页面，headless Chrome 出 2 倍 PNG。
  内容块 `kpis / table / list / chart / progress / form / timeline`，状态标签按文案自动配色。
- `copyright_apply_info`：从仓库 + git + 说明书推导申请表填报信息，输出 Markdown 填报单
  （源程序量、语言、框架、数据库、完成日期、功能模块、300 字简介草稿、技术特点）。

### Changed
- 源程序文档的分页从「插入 break 运行」改为「段前分页 + 固定行距」，分页结果不依赖渲染器。
- 说明书插入目录后改用段前分页，避免空段落。

## 0.1.0 — 2026-10-29

### Added
- `copyright_source_doc`：源程序鉴别材料（前后各 30 页 / 每页 50 行 / 页眉软件名+版本号 / 右上角页码）。
- `copyright_manual`：软件说明书排版（自动编号、图片图注、表格、目录域）。
- `copyright_kit_status`：环境自检。
