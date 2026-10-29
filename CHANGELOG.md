# Changelog

## 0.3.0 — 2026-10-29

### Added
- `copyright_pack`：批量出件。一份 manifest 为多个软件各生成一套材料（源程序 + 截图 + 说明书 + 申请表），
  说明书按「章节标题 === 截图标题」自动挂图，单件失败不影响其它件。

### Fixed
- 源程序量与源程序文档口径不一致：`copyright_apply_info` 新增 `exclude` 参数，与 `copyright_source_doc` 对齐。
- 收录范围误抓第三方静态资源（Cesium、UEditor、pdf.js）与锁文件（`pnpm-lock.yaml` 等），
  导致源程序量与文档内容虚高。现在按目录名、`.min.`、平均行长、单文件大小四道规则过滤。
- 循环依赖：python 执行器抽到 `lib/pyrun.js`。

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
