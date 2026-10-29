#!/usr/bin/env python3
"""从代码仓库抽出「可核对的附录」，补进软件说明书。

不是让模型编，而是从代码里数出来：
  - 接口清单：FastAPI / Flask 路由（方法、路径、函数名、首行说明）
  - 数据表清单：SQLAlchemy / Django 模型（表名、字段数、字段名）
  - 源代码组织：各目录文件数与行数

输出 {"sections": [...]}，可直接被 manualgen.py --append 合并。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

SKIP_DIRS = {
    "node_modules", ".git", ".venv", "venv", "dist", "build", "__pycache__",
    ".pytest_cache", ".ruff_cache", ".uv-cache", ".idea", ".vscode", "coverage",
    "public", "static", "third-party", "third_party", "libs", "vendor", "assets",
    "ueditor", "cesiumunminified", "documentation",
}
MAX_INTERFACES = 60
MAX_MODELS = 40

ROUTE_RE = re.compile(
    r'@(?:\w+\.)?(get|post|put|delete|patch|api_route)\(\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)
FUNC_RE = re.compile(r"^\s*(?:async\s+)?def\s+(\w+)\s*\(")
DOC_RE = re.compile(r'^\s*(?:"""|\'\'\')\s*(.+)$')
MODEL_RE = re.compile(r"^class\s+(\w+)\s*\((.*?)\)\s*:", re.MULTILINE)
TABLENAME_RE = re.compile(r'__tablename__\s*=\s*["\'](\w+)["\']')
COLUMN_RE = re.compile(r"^\s+(\w+)\s*=\s*Column\(", re.MULTILINE)
FIELD_RE = re.compile(r"^\s+(\w+)\s*=\s*models\.\w+Field\(", re.MULTILINE)


def py_files(root: Path):
    for p in root.rglob("*.py"):
        rel = p.relative_to(root)
        if any(part.lower() in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if p.name.startswith("."):
            continue
        try:
            if p.stat().st_size > 1024 * 1024:
                continue
        except OSError:
            continue
        yield p


def norm_path(path: str) -> str:
    """把 /api/v1/items/{item_id} 里的参数统一成 {id}，便于阅读。"""
    return re.sub(r"\{[^}]+\}", "{id}", path)


def scan_routes(root: Path):
    routes = []
    for p in py_files(root):
        try:
            lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines):
            m = ROUTE_RE.search(line)
            if not m:
                continue
            method = m.group(1).upper()
            if method == "API_ROUTE":
                method = "ANY"
            path = norm_path(m.group(2))
            func = ""
            desc = ""
            for j in range(i + 1, min(i + 6, len(lines))):
                fm = FUNC_RE.match(lines[j])
                if fm:
                    func = fm.group(1)
                    # 函数体第一行 docstring 当说明
                    for k in range(j + 1, min(j + 6, len(lines))):
                        dm = DOC_RE.match(lines[k])
                        if dm:
                            desc = dm.group(1).strip().strip('"').strip("'")
                            desc = re.sub(r"[*#`>]+", "", desc).strip()
                            break
                    break
            routes.append({
                "method": method,
                "path": path,
                "func": func,
                "desc": desc or func.replace("_", " "),
                "file": p.relative_to(root).as_posix(),
            })
    # 去重（同一路由可能被多个前缀包含）
    seen = set()
    uniq = []
    for r in routes:
        key = (r["method"], r["path"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)
    return uniq


def scan_models(root: Path):
    models = []
    for p in py_files(root):
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for m in MODEL_RE.finditer(text):
            cls, bases = m.group(1), m.group(2)
            if "Base" not in bases and "Model" not in bases:
                continue
            block = text[m.end(): m.end() + 4000]
            tname = TABLENAME_RE.search(block)
            cols = COLUMN_RE.findall(block) or FIELD_RE.findall(block)
            if not tname and not cols:
                continue
            models.append({
                "class": cls,
                "table": tname.group(1) if tname else cls.lower(),
                "fields": cols,
                "file": p.relative_to(root).as_posix(),
            })
    # 同一张表可能在多个模块重复定义，按表名去重
    seen = set()
    uniq = []
    for m in models:
        if m["table"] in seen:
            continue
        seen.add(m["table"])
        uniq.append(m)
    return uniq


def dir_stats(root: Path):
    counter: Counter = Counter()
    lines_by_dir: Counter = Counter()
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(root)
        if any(part.lower() in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if p.suffix.lower() not in {".py", ".js", ".ts", ".vue", ".java", ".go", ".sql"}:
            continue
        top = rel.parts[0] if len(rel.parts) > 1 else "."
        counter[top] += 1
        try:
            lines_by_dir[top] += sum(
                1 for line in p.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip()
            )
        except OSError:
            pass
    return counter, lines_by_dir


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--title", default="附录")
    args = ap.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"root is not a directory: {root}", file=sys.stderr)
        return 2

    routes = scan_routes(root)
    models = scan_models(root)
    counter, lines_by_dir = dir_stats(root)

    sections = []

    if counter:
        top = sorted(counter.items(), key=lambda kv: -lines_by_dir[kv[0]])[:12]
        sections.append({
            "heading": "源代码组织",
            "level": 2,
            "paragraphs": [
                f"本系统源代码按目录组织，主要目录的文件数与有效代码行数如下表。统计范围为 {root.name} 仓库内的业务源代码，不含依赖包与第三方静态资源。"
            ],
            "table": {
                "header": ["目录", "文件数", "有效行数"],
                "rows": [[d, str(n), str(lines_by_dir[d])] for d, n in top],
            },
        })

    if routes:
        rows = []
        for i, r in enumerate(routes[:MAX_INTERFACES], start=1):
            rows.append([str(i), r["method"], r["path"], r["desc"][:40]])
        sections.append({
            "heading": "业务接口清单",
            "level": 2,
            "paragraphs": [
                f"系统对外提供 HTTP 接口共 {len(routes)} 个（去重后计数），下表列出其中 {len(rows)} 个，"
                "包含请求方法、路径与业务含义。接口说明取自代码中的函数注释。"
            ],
            "table": {"header": ["序号", "方法", "接口路径", "说明"], "rows": rows},
        })

    if models:
        rows = []
        for i, m in enumerate(models[:MAX_MODELS], start=1):
            fields = "、".join(m["fields"][:8]) + ("…" if len(m["fields"]) > 8 else "")
            rows.append([str(i), m["table"], str(len(m["fields"])), fields or "-"])
        sections.append({
            "heading": "数据表清单",
            "level": 2,
            "paragraphs": [
                f"系统核心数据表共 {len(models)} 张，下表列出表名、字段数量与主要字段，表结构由代码中的模型定义导出。"
            ],
            "table": {"header": ["序号", "表名", "字段数", "主要字段"], "rows": rows},
        })

    if not sections:
        print("没有识别到可导出的接口或数据表", file=sys.stderr)
        return 3

    payload = {"sections": sections}
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"routes : {len(routes)}")
    print(f"models : {len(models)}")
    print(f"dirs   : {len(counter)}")
    print(f"out    : {out}")
    print("##DSH_JSON## " + json.dumps({
        "ok": True,
        "json": str(out),
        "routes": len(routes),
        "models": len(models),
        "sections": len(sections),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
