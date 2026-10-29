/** 运行插件自带的 python 脚本，返回 { stdout, stderr, payload }。 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PY_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'python')
export const PYTHON = process.env.DSH_COPYRIGHT_PYTHON || 'python3'
export const MARKER = '##DSH_JSON##'

export function runPython(script, args, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [script, ...args], {
      cwd: PY_DIR,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      signal,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (err) => {
      reject(new Error(`无法启动 ${PYTHON}：${err.message}。可用环境变量 DSH_COPYRIGHT_PYTHON 指定解释器。`))
    })
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${path.basename(script)} 退出码 ${code}\n${(stderr || stdout).trim().slice(-1500)}`))
        return
      }
      const line = stdout.split('\n').reverse().find((l) => l.startsWith(MARKER))
      let payload = null
      if (line) {
        try {
          payload = JSON.parse(line.slice(MARKER.length).trim())
        } catch {
          payload = null
        }
      }
      resolve({ stdout, stderr, payload })
    })
  })
}
