# dsh-copyright-kit · 软著工坊

把「一个代码仓库 + 一个软件名」变成软件著作权登记要交的材料。DeepSeek Harness 插件。

![运行总览](./demo/screens/01-总览-运行总览.png)

> 为什么要它：软著材料里最费时间的不是写内容，是**排版合规**——源程序前后各 30 页、每页不少于 50 行、页眉要软件名+版本号、右上角要页码。这些规则是死的，但每次都要手工折腾一遍。

## 安装

**从 GitHub 装（推荐）**

```bash
dsh plugin --profile web add github:Lucky020/dsh-copyright-kit
```

**本地开发（link 安装，改代码立刻生效，不用重新发版）**

```bash
dsh plugin --profile web add link:/absolute/path/to/dsh-copyright-kit
```

装完重启 `dsh web` —— server 端工具要重启才会注册。

> 两种不要同时装：会重复注册同名工具，报 `already registered`。

依赖：

| 用途 | 依赖 |
|---|---|
| 源程序文档 / 说明书 | `python3` + `python-docx` |
| 界面截图 | Google Chrome（或 Chromium / Edge）；也可用 `DSH_COPYRIGHT_CHROME` 指定可执行文件 |

```bash
python3 -m pip install python-docx
```

## 五个工具

### `copyright_source_doc` — 源程序鉴别材料

```json
{
  "root": "/Users/you/project/donghuan",
  "software_name": "设备管理系统软件",
  "version": "V1.0",
  "out_path": "/Users/you/软著/设备管理系统软件_V1.0_源程序.docx",
  "exclude": ["tests", "migrations"]
}
```

- 递归收集源码（自动跳过 `node_modules`、`.venv`、`dist`、二进制、锁文件、隐藏文件）
- 少于 60 页 → 全量提交；否则取**前 30 页 + 后 30 页**
- 每页固定 50 行，显式分页符，行距固定 → 分页与 Word/WPS 渲染无关，可复现
- 页眉：`软件名  V1.0`，右上角 `PAGE` 域自动页码
- 输出结构化结果：页数、收录文件数、总行数、提交行数

### `copyright_manual` — 软件说明书排版

先把内容写成一个 JSON spec：

```json
{
  "software_name": "设备管理系统软件",
  "version": "V1.0",
  "toc": true,
  "sections": [
    { "heading": "引言", "level": 1, "paragraphs": ["本文档说明……"] },
    { "heading": "系统概述", "level": 2, "paragraphs": ["面向运维人员……"], "bullets": ["设备台账", "巡检计划"] },
    { "heading": "功能模块", "level": 2,
      "table": { "header": ["模块", "说明"], "rows": [["台账", "设备基础信息"]] } },
    { "heading": "系统首页", "level": 2, "paragraphs": ["……"], "image": "/abs/shot.png", "caption": "图 1  系统首页" }
  ]
}
```

```json
{ "spec_path": "/abs/spec.json", "out_path": "/abs/说明书.docx" }
```

- 标题自动编号（1 / 1.1 / 1.1.1），一级黑体三号、二级黑体四号
- 正文宋体小四、1.5 倍行距（每页 ≥30 行），首行缩进 2 字符
- 图片居中、限宽 14cm、图注居中；表格套用 Table Grid
- 页眉软件名+版本号、右上角页码
- `toc: true` 插入目录域（Word 打开后右键 → 更新域）

### `copyright_screens` — 五屏界面截图

按一份 spec 渲染**同一套壳**下的多张页面，headless Chrome 出 2 倍高清 PNG（默认 3200×2000）。

```json
{
  "software_name": "设备管理系统软件",
  "version": "V1.0",
  "subtitle": "Equipment Management System V1.0",
  "user": "运维主管 · 张工",
  "time": "2026-10-29 09:20",
  "nav": ["运行总览", "设备台账", "点检管理", "维保工单", "统计报表"],
  "screens": [
    { "id": "01-总览", "title": "运行总览", "active": "运行总览",
      "blocks": [
        { "type": "kpis", "items": [{ "label": "设备总数", "value": "1,286", "sub": "在用 1,204" }] },
        { "type": "table", "title": "设备实时状态", "span": 8, "toneColumns": [3],
          "columns": ["设备编号", "名称", "状态"],
          "rows": [["EQ-2026-0431", "一号线空压机", "运行中"]] },
        { "type": "list", "title": "待处理告警", "span": 4,
          "items": [{ "title": "温度偏高", "sub": "EQ-2026-0431", "tag": "紧急" }] }
      ] }
  ]
}
```

内容块（`span` 是 12 栅格里的列宽，默认见括号）：

| 类型 | 说明 | 默认 span |
|---|---|---|
| `kpis` | 顶部指标卡，4 列 | 12 |
| `table` | 数据表；`toneColumns` 指定哪几列按文案自动打状态标签 | 8 |
| `list` | 右侧列表（标题 + 副标题 + 标签） | 4 |
| `chart` | 柱状图（`bars`），`unit`/`max` 可选 | 6 |
| `progress` | 指标 + 进度条（`metrics` / `bar` / `after`） | 4 |
| `form` | 双列字段卡（详情页） | 6 |
| `timeline` | 流程时间轴（`state`: `done` / `active`） | 4 |

状态标签按文案自动配色：`紧急|停机|故障|超期|低于安全库存` → 红，`一般|待机|逾期` → 黄，`维保中|处理中` → 蓝，`正常|运行中|已完成|充足` → 绿。

**排版经验**：每屏放 **3 行**内容块（KPI 行 + 两个内容行）刚好填满 1600×1000；只有 2 行会在底部留大片空白。内容少的页面可以在 spec 里把 `height` 调到 820。

### `copyright_apply_info` — 申请表填报信息

```json
{
  "root": "/Users/you/project/donghuan",
  "software_name": "设备管理系统软件",
  "version": "V1.0",
  "spec_path": "/abs/spec.json",
  "developer": "某某科技有限公司",
  "out_path": "/abs/申请表信息.md"
}
```

能算的都算，算不出来的标 ⚠：

| 字段 | 来源 |
|---|---|
| 源程序量 / 源码文件数 / 编程语言 | 扫描仓库（跳过依赖、构建产物、二进制） |
| 开发框架 / 数据库 | 解析 `requirements.txt`、`package.json`、`pom.xml`、`go.mod`、`Dockerfile` 等 |
| 开发完成日期 | git 最后一次提交日期 |
| 面向领域 / 功能模块 | 说明书 spec 的章节 + 名称关键词 |
| 功能简介（≤300 字）/ 技术特点 | 由模块名与依赖栈拼成**草稿**，需人工改写 |

输出一份 Markdown 填报单，字段可逐项复制进软著在线申请表。框架与数据库识别按**词边界**匹配，不会把 `login` 认成 Go 的 Gin。

### `copyright_kit_status` — 环境自检

生成失败时先跑它：检查 python3、python-docx、两个脚本是否存在。

## 发布到 npm（维护者）

> 注意：本机 `~/.npmrc` 里是 `registry.npm.taobao.org`（已废弃的镜像），登录和发布都要显式指定官方源。

```bash
npm login --registry=https://registry.npmjs.org/
npm publish --registry=https://registry.npmjs.org/
```

npm 默认要求 2FA，发布会索要一次性验证码；也可以用带 Publish 权限的 Granular Token 免 OTP。

发布前自查：

```bash
npm pack --dry-run     # 只应包含 lib/、cordis.patch.yml、README、CHANGELOG、LICENSE
```

## 已知边界

- 右上角页码用的是 Word 右对齐制表位；macOS Quick Look 既**不认自定义制表位、也不分页**，所以在 Finder 预览里页码会挤在标题后面、目录与正文连成一片。Word / WPS 打开正常，不影响提交。
- 源程序文档的 60 页是**构造出来的**：每页 50 段、行距固定 11.5pt（50 × 11.5 = 575pt，小于可用 728pt），每页首段带「段前分页」。所以页数与每页行数不依赖渲染器。
- 说明书分页随内容流动，不保证每页恰好 30 行（1.5 倍行距下约 32 行）。
- 截图里的数据是**示例数据**，提交前请按真实项目改一遍字段与数值——软著审查看的是界面与功能是否真实对应，不是数字好不好看。
- 截图按 1600×1000 固定视口渲染，比这更宽的表格会被压窄；表格列多时拆成两屏更稳。
- 源程序按文件路径排序抽取；如需特定顺序，先用 `exclude` 收窄范围。

## 路线

- **P0（已完成）** 源程序文档 + 说明书排版
- **P1（已完成）** 五屏界面截图：一套壳 + 7 种内容块 → headless Chrome 出 2 倍 PNG，路径直接喂给 `copyright_manual`
- **P2（已完成）** 申请表字段推导：源程序量、语言、框架、数据库、完成日期、功能模块、300 字简介草稿
- **P3** 一仓多软件、批量件、合规自检报告

## 许可

MIT
