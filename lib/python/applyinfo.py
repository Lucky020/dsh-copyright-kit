#!/usr/bin/env python3
"""软著「申请表填报信息」推导器。

从代码仓库与说明书 spec 里能算的字段全部算出来，算不出来的标成待人工确认，
避免在申请表里手填「源程序量」「开发环境」时拍脑袋。

输出：Markdown 填报单 + `##DSH_JSON##` 结构化结果。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

# 第三方静态资源：Cesium / UEditor / pdf.js 这类整包库，收进软著文档没有意义
VENDOR_DIRS = {
    "public", "static", "third-party", "third_party", "libs", "vendor", "assets",
    "ueditor", "cesiumunminified", "documentation", "node_modules", "dist", "build",
}
SKIP_DIRS = {
    "node_modules", ".git", ".venv", "venv", "dist", "build", "__pycache__",
    ".pytest_cache", ".ruff_cache", ".uv-cache", ".idea", ".vscode", "coverage",
    "vendor", "target", ".next", ".cache", ".mypy_cache", ".tox", "site-packages",
}
LOCK_NAMES = {
    "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "npm-shrinkwrap.json",
    "composer.lock", "poetry.lock", "uv.lock", "cargo.lock", "go.sum",
    "pnpm-workspace.yaml",
}
MAX_FILE_BYTES = 1024 * 1024
BINARY_SUFFIX = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf", ".zip", ".tar", ".gz",
    ".woff", ".woff2", ".ttf", ".mp4", ".mp3", ".map", ".pyc", ".so", ".dll",
    ".exe", ".bin", ".jar", ".class", ".lock", ".log",
}

LANG = {
    ".py": "Python", ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".jsx": "JavaScript", ".vue": "Vue",
    ".java": "Java", ".kt": "Kotlin", ".go": "Go", ".rs": "Rust", ".c": "C",
    ".h": "C", ".cpp": "C++", ".hpp": "C++", ".cs": "C#", ".php": "PHP", ".rb": "Ruby",
    ".swift": "Swift", ".sql": "SQL", ".sh": "Shell", ".html": "HTML", ".css": "CSS",
    ".scss": "SCSS", ".less": "Less", ".dart": "Dart", ".scala": "Scala", ".lua": "Lua",
}

FRAMEWORKS = {
    "fastapi": "FastAPI", "flask": "Flask", "django": "Django", "tornado": "Tornado",
    "sqlalchemy": "SQLAlchemy", "pydantic": "Pydantic", "celery": "Celery",
    "uvicorn": "Uvicorn", "alembic": "Alembic", "pandas": "Pandas", "numpy": "NumPy",
    "vue": "Vue", "react": "React", "next": "Next.js", "element-ui": "Element UI",
    "element-plus": "Element Plus", "antd": "Ant Design", "ant-design-vue": "Ant Design Vue",
    "echarts": "ECharts", "three": "Three.js", "vite": "Vite", "webpack": "Webpack",
    "pinia": "Pinia", "vuex": "Vuex", "axios": "Axios", "spring-boot": "Spring Boot",
    "mybatis": "MyBatis", "spring": "Spring", "gin": "Gin", "django-rest-framework": "DRF",
    "miniui": "uni-app", "uniapp": "uni-app", "@dcloudio/uni-app": "uni-app",
}
DB_KEYWORDS = {
    "mysql": "MySQL", "postgresql": "PostgreSQL", "postgres": "PostgreSQL",
    "sqlite": "SQLite", "redis": "Redis", "mongodb": "MongoDB", "mongo": "MongoDB",
    "dm8": "达梦 DM8", "dameng": "达梦 DM8", "kingbase": "人大金仓", "oracle": "Oracle",
    "clickhouse": "ClickHouse", "elasticsearch": "Elasticsearch",
}
DOMAIN_HINTS = [
    (r"设备|台账|点检|维保", "工业设备运行与维护管理"),
    (r"巡检", "工业设施巡检管理"),
    (r"热网|供热|换热", "供热管网运行管理"),
    (r"超限|超载|治超|非现场", "道路运输超限治理"),
    (r"安全生产|双重预防|隐患", "安全生产风险管控"),
    (r"地理信息|GIS|地图|空间", "地理信息管理"),
    (r"视频|监控|事件研判|联动调度", "视频事件研判与联动调度"),
    (r"知识库|智能体|问答|RAG", "知识库与智能问答"),
    (r"发票|票据|报销|财务", "票据与财务管理"),
    (r"决策|分析|驾驶舱|大屏", "经营分析与辅助决策"),
    (r"校园|教务|学生", "教育教务管理"),
    (r"电商|订单|商城|库存", "电商订单与库存管理"),
]


def walk(root: Path, excludes: tuple[str, ...] = ()):
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(root)
        if any(part.lower() in VENDOR_DIRS or part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if any(ex and ex in rel.as_posix() for ex in excludes):
            continue
        if p.name.startswith("."):
            continue
        if p.suffix.lower() in BINARY_SUFFIX:
            continue
        if p.name.lower() in LOCK_NAMES or ".min." in p.name.lower():
            continue
        try:
            if p.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue
        yield p


def scan_code(root: Path, excludes: tuple[str, ...] = ()):
    by_lang: Counter = Counter()
    files = 0
    for p in walk(root, excludes):
        lang = LANG.get(p.suffix.lower())
        if not lang:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        raw = text.splitlines()
        if raw and sum(len(x) for x in raw) / len(raw) > 200:
            continue
        n = sum(1 for line in raw if line.strip())
        if n == 0:
            continue
        by_lang[lang] += n
        files += 1
    return by_lang, files


def read_manifests(root: Path) -> str:
    chunks: list[str] = []
    for name in (
        "requirements.txt", "pyproject.toml", "Pipfile", "package.json",
        "pom.xml", "go.mod", "build.gradle", "Cargo.toml", ".python-version",
        "Dockerfile", "docker-compose.yml", "docker-compose.yaml", "README.md",
    ):
        for p in root.rglob(name):
            if any(part in SKIP_DIRS for part in p.relative_to(root).parts[:-1]):
                continue
            try:
                if p.stat().st_size < 400_000:
                    chunks.append(p.read_text(encoding="utf-8", errors="ignore"))
            except OSError:
                pass
            break  # 只取最靠近根目录的那一个
    return "\n".join(chunks).lower()


def detect(text: str, table: dict) -> list[str]:
    """按键名的词边界匹配，避免 gin 命中 login、vue 命中 vuex 这类误报。"""
    found = []
    for key, label in table.items():
        if label in found:
            continue
        if re.search(r"(?<![a-z0-9_-])" + re.escape(key) + r"(?![a-z0-9_-])", text):
            found.append(label)
    return found


def git_info(root: Path) -> dict:
    def run(*args: str) -> str:
        try:
            return subprocess.run(
                ["git", "-C", str(root), *args],
                capture_output=True, text=True, timeout=15,
            ).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            return ""

    first = run("log", "--reverse", "--format=%ad", "--date=short").splitlines()[:1]
    last = run("log", "-1", "--format=%ad", "--date=short").strip()
    count = run("rev-list", "--count", "HEAD").strip()
    branch = run("rev-parse", "--abbrev-ref", "HEAD").strip()
    return {
        "first_commit": first[0] if first else "",
        "last_commit": last,
        "commits": count,
        "branch": branch,
    }


def load_spec(path: str | None) -> dict:
    if not path:
        return {}
    try:
        return json.loads(Path(path).expanduser().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def guess_domain(name: str, spec: dict, headings: list[str]) -> str:
    blob = name + " " + " ".join(headings) + " " + json.dumps(spec, ensure_ascii=False)
    for pattern, label in DOMAIN_HINTS:
        if re.search(pattern, blob):
            return label
    return "企业业务管理"


DOC_HEADINGS = {
    "引言", "编写目的", "适用范围", "术语与缩略语", "系统概述", "系统定位", "用户角色",
    "运行环境", "功能说明", "操作说明", "登录与退出", "典型业务操作", "异常处理",
    "技术特点", "部署说明", "维护说明", "附录",
}


def collect_features(sections: list[dict]) -> list[str]:
    """优先取「功能说明」下的二级标题；退化为全部非文档性二级标题。"""
    in_func = False
    picked: list[str] = []
    for s in sections:
        level = s.get("level") or 1
        h = str(s.get("heading") or "").strip()
        if not h:
            continue
        if level == 1:
            in_func = ("功能" in h) or ("模块" in h) or ("子系统" in h)
            continue
        if level == 2 and in_func and h not in DOC_HEADINGS:
            picked.append(h)
    if picked:
        return picked
    return [str(s.get("heading")).strip() for s in sections
            if (s.get("level") or 1) == 2 and str(s.get("heading") or "").strip() not in DOC_HEADINGS]


def short_name(name: str) -> str:
    s = re.sub(r"(软件|系统|平台|应用|管理系统|软件系统)$", "", name).strip()
    return s or name


def build_summary(name: str, domain: str, features: list[str], stack: list[str]) -> str:
    mods = "、".join(features[:5]) if features else "基础数据管理与业务办理"
    tech = "、".join(stack[:3]) if stack else "B/S 架构"
    head = f"{name}是面向{domain}的应用软件，包含{mods}等功能模块。"
    tail = f"系统采用{tech}实现，支持多角色权限管理与数据查询统计。"
    text = head + tail
    if len(text) > 300:
        text = text[:297] + "…"
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--version", default="V1.0")
    ap.add_argument("--spec")
    ap.add_argument("--out", required=True)
    ap.add_argument("--domain")
    ap.add_argument("--developer", default="待填写")
    ap.add_argument("--exclude", action="append", default=[])
    args = ap.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"root is not a directory: {root}", file=sys.stderr)
        return 2

    spec = load_spec(args.spec)
    excludes = tuple(e for e in args.exclude if e)
    by_lang, files = scan_code(root, excludes)
    manifests = read_manifests(root)
    git = git_info(root)

    total_lines = sum(by_lang.values())
    langs = [k for k, v in by_lang.most_common(4) if total_lines and v * 100 // total_lines >= 3][:3]
    if not langs and by_lang:
        langs = [by_lang.most_common(1)[0][0]]
    frameworks = detect(manifests, FRAMEWORKS)
    dbs = detect(manifests, DB_KEYWORDS)

    sections = spec.get("sections", [])
    headings = [str(s.get("heading")) for s in sections if s.get("heading")]
    features = collect_features(sections)
    if not features:
        features = [h for h in headings if h not in DOC_HEADINGS][:8]

    domain = args.domain or guess_domain(args.name, spec, headings)
    stack = frameworks[:3] or langs[:2]
    summary = build_summary(args.name, domain, features, stack)

    warnings: list[str] = []
    if not spec:
        warnings.append("没有提供说明书 spec，功能模块与技术特点由标题/依赖推导，需人工补写")
    if not git["last_commit"]:
        warnings.append("仓库没有 git 历史，开发完成日期与源程序量需人工确认")
    if len(summary) > 300:
        warnings.append(f"功能简介草稿 {len(summary)} 字，超过 300 字上限，请压缩")
    if not frameworks:
        warnings.append("未从依赖清单识别出框架，开发软件环境请人工补充")
    warnings.append("功能简介是模板草稿（按模块名拼接），提交前请按真实业务改写成通顺的一句话概括")

    dev_os = "Linux（CentOS 7 / Ubuntu 20.04）"
    run_os = "Linux（CentOS 7 及以上）"
    if "docker" in (root / "Dockerfile").name.lower() or (root / "docker-compose.yml").exists():
        run_os = "Linux + Docker 容器化部署"

    fields = {
        "软件全称": args.name,
        "软件简称": short_name(args.name),
        "版本号": args.version,
        "著作权人": args.developer,
        "开发完成日期": git["last_commit"] or "待填写",
        "首次发表日期": "未发表",
        "开发方式": "独立开发",
        "权利取得方式": "原始取得",
        "软件分类": "应用软件",
        "面向领域": domain,
        "编程语言": "、".join(langs) or "待填写",
        "开发框架": "、".join(frameworks) or "待填写",
        "数据库": "、".join(dbs) or "待填写",
        "开发硬件环境": "x86_64 服务器 / 开发用 PC",
        "运行硬件环境": "x86_64 服务器 4 核 8G 及以上",
        "开发操作系统": dev_os,
        "运行操作系统": run_os,
        "源程序量": f"{total_lines} 行",
        "源码文件数": str(files),
        "功能模块": "、".join(features[:10]) if features else "待填写",
    }

    lines = [
        f"# {args.name} {args.version} · 软著申请表填报信息",
        "",
        "> 由 dsh-copyright-kit 从代码仓库与说明书推导。**提交前请逐项核对**，标 ⚠ 的项必须人工确认。",
        "",
        "## 一、申请表字段",
        "",
        "| 字段 | 内容 |",
        "| --- | --- |",
    ]
    for k, v in fields.items():
        mark = " ⚠" if v in ("待填写", "未发表") and k not in ("首次发表日期",) else ""
        lines.append(f"| {k} | {v}{mark} |")

    lines += [
        "",
        "## 二、主要功能（功能简介，≤300 字）",
        "",
        f"（{len(summary)} 字）",
        "",
        summary,
        "",
        "## 三、技术特点（可直接粘贴）",
        "",
    ]
    tech_points = []
    if langs:
        tech_points.append(f"采用 {'、'.join(langs)} 开发，前后端分离。")
    if frameworks:
        tech_points.append(f"后端/前端基于 {'、'.join(frameworks[:4])} 构建。")
    if dbs:
        tech_points.append(f"数据存储使用 {'、'.join(dbs)}。")
    if git["last_commit"]:
        tech_points.append(f"源码规模约 {total_lines} 行，{files} 个源文件，git 提交 {git['commits']} 次。")
    tech_points.append("按角色划分权限与数据范围，业务数据统一主数据管理。")
    lines += [f"{i + 1}. {t}" for i, t in enumerate(tech_points)]

    lines += ["", "## 四、检出依据", ""]
    if by_lang:
        share = "、".join(
            f"{k} {v * 100 // max(1, total_lines)}%" for k, v in by_lang.most_common(5)
        )
        lines.append(f"- 语言分布：{share}")
    lines.append(f"- 框架/库：{'、'.join(frameworks) if frameworks else '未识别'}")
    lines.append(f"- 数据库：{'、'.join(dbs) if dbs else '未识别'}")
    if git["last_commit"]:
        lines.append(f"- git：{git['first_commit']} → {git['last_commit']}，共 {git['commits']} 次提交（{git['branch']}）")
    lines.append(f"- 说明书章节：{len(headings)} 个")
    if warnings:
        lines += ["", "## 五、待人工确认", ""]
        lines += [f"- ⚠ {w}" for w in warnings]

    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"source_lines : {total_lines} ({files} files)")
    print(f"features     : {len(features)}")
    print(f"summary      : {len(summary)} chars")
    print(f"warnings     : {len(warnings)}")
    print(f"out          : {out}")
    print("##DSH_JSON## " + json.dumps({
        "ok": True,
        "md": str(out),
        "software_name": args.name,
        "source_lines": total_lines,
        "source_pages": (total_lines + 49) // 50,
        "features": len(features),
        "summary": summary,
        "summary_chars": len(summary),
        "languages": langs,
        "frameworks": frameworks,
        "databases": dbs,
        "completed_date": git["last_commit"],
        "warnings": warnings,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
