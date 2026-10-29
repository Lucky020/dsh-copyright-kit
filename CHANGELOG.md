# Changelog

## 0.5.0 — 2026-10-29

### Added
- 说明书**封面页**：软件名称、版本文档类型、著作权人、日期；封面不显示页眉与页码（`different_first_page_header_footer`）。
- spec 新增 `developer` / `date` / `cover` 字段，`copyright_pack` 会把 manifest 的 `developer` 自动注入。

### Fixed
- 表格固定布局 + 显式列宽 + `tblW`，避免 Word 把两列表压成 1:1。
- `--append` 的附录包在「附录」一级章节下。
- 源程序排序业务代码优先（`app/`、`src/` 在 `alembic/`、`scripts/` 之前）。
- `applyinfo` 新增 `--published`；未提供时填「待填写」而不是猜「未发表」。

## 0.4.0 — 2026-10-29

### Added
- `copyright_manual` / `copyright_pack` 支持**代码附录**：自动从仓库抽取「源代码组织 / 业务接口清单 / 数据表清单」，
  三张表来自路由与模型定义，可核对，同时补足篇幅（实测 8 页 → 14 页）。
- 章节支持 `steps`（编号步骤）。
- 生成结果返回 `est_pages`（估算页数）与 `thin`（< 20 页）标记，不再靠肉眼判断够不够。

### Changed
- 重写 demo 的说明书 spec：设备管理系统 8 页 → **28 页**，智慧热网 8 页 → **18 页**（仅前端仓库，无接口可导）。
- README 增加「篇幅配方」：每页约 1,000 字 / 1 图 ≈ 0.5 页 / 1 表行 ≈ 1.6 行正文。

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
