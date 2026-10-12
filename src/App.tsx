import { useMemo, useRef, useState } from 'react'
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  Download,
  FileJson2,
  FileUp,
  FoldVertical,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type Path = (string | number)[]
type ParseIssue = { message: string; location?: string }

const SAMPLE = `{
  "project": "Northstar API",
  "version": "2.4.0",
  "environment": "production",
  "healthy": true,
  "features": {
    "analytics": true,
    "exports": ["json", "csv", "pdf"],
    "maxRequestsPerMinute": 1200
  },
  "endpoints": [
    { "path": "/users", "method": "GET", "latencyMs": 42 },
    { "path": "/reports", "method": "POST", "latencyMs": 86 }
  ],
  "maintainer": {
    "name": "Avery Chen",
    "team": "Platform",
    "contact": null
  }
}`

const INITIAL_VALUE = JSON.parse(SAMPLE) as JsonValue
const pathId = (path: Path) => JSON.stringify(path)
const isContainer = (value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } =>
  value !== null && typeof value === 'object'
const entriesOf = (value: JsonValue): [string | number, JsonValue][] => {
  if (Array.isArray(value)) return value.map((item, index) => [index, item])
  if (isContainer(value)) return Object.entries(value)
  return []
}
const typeOf = (value: JsonValue) =>
  value === null
    ? 'null'
    : Array.isArray(value)
      ? 'array'
      : typeof value === 'object'
        ? 'object'
        : typeof value
const valueAsText = (value: JsonValue) => JSON.stringify(value, null, 2)
const pathAsText = (path: Path) =>
  path.reduce<string>((text, part) => {
    if (typeof part === 'number') return `${text}[${part}]`
    return /^[A-Za-z_$][\w$]*$/.test(part) ? `${text}.${part}` : `${text}[${JSON.stringify(part)}]`
  }, '$')

function getIssue(error: unknown, source: string): ParseIssue {
  const message = error instanceof Error ? error.message : 'Unable to parse this JSON.'
  const position = /position (\d+)/i.exec(message)
  const lineColumn = /line (\d+) column (\d+)/i.exec(message)
  if (lineColumn) return { message, location: `Line ${lineColumn[1]}, column ${lineColumn[2]}` }
  if (position) {
    const before = source.slice(0, Number(position[1]))
    const lines = before.split('\n')
    return { message, location: `Line ${lines.length}, column ${(lines.at(-1)?.length ?? 0) + 1}` }
  }
  return { message }
}

function initialExpanded(value: JsonValue) {
  const ids = new Set<string>([pathId([])])
  for (const [key, child] of entriesOf(value)) {
    if (isContainer(child)) ids.add(pathId([key]))
  }
  return ids
}

function countData(value: JsonValue) {
  const stats = { nodes: 0, objects: 0, arrays: 0, depth: 0 }
  const stack: { value: JsonValue; depth: number }[] = [{ value, depth: 0 }]
  while (stack.length) {
    const item = stack.pop()!
    stats.nodes++
    stats.depth = Math.max(stats.depth, item.depth)
    if (Array.isArray(item.value)) stats.arrays++
    else if (isContainer(item.value)) stats.objects++
    for (const [, child] of entriesOf(item.value))
      stack.push({ value: child, depth: item.depth + 1 })
  }
  return stats
}

function findMatches(value: JsonValue, query: string) {
  const matches = new Set<string>()
  const ancestors = new Set<string>()
  if (!query.trim()) return { matches, ancestors }
  const needle = query.toLocaleLowerCase()
  const stack: { value: JsonValue; path: Path; key: string }[] = [{ value, path: [], key: 'root' }]
  while (stack.length) {
    const item = stack.pop()!
    const primitive = !isContainer(item.value) ? String(item.value) : ''
    if (
      item.key.toLocaleLowerCase().includes(needle) ||
      primitive.toLocaleLowerCase().includes(needle)
    ) {
      matches.add(pathId(item.path))
      for (let i = 0; i < item.path.length; i++) ancestors.add(pathId(item.path.slice(0, i)))
    }
    for (const [key, child] of entriesOf(item.value))
      stack.push({ value: child, path: [...item.path, key], key: String(key) })
  }
  return { matches, ancestors }
}

function allExpandable(value: JsonValue) {
  const ids = new Set<string>()
  const stack: { value: JsonValue; path: Path }[] = [{ value, path: [] }]
  while (stack.length) {
    const item = stack.pop()!
    if (!isContainer(item.value)) continue
    ids.add(pathId(item.path))
    for (const [key, child] of entriesOf(item.value))
      stack.push({ value: child, path: [...item.path, key] })
  }
  return ids
}

function getAtPath(value: JsonValue, path: Path): JsonValue {
  let current = value
  for (const part of path) {
    if (!isContainer(current)) return current
    current = (current as Record<string | number, JsonValue>)[part] as JsonValue
  }
  return current
}

type TreeNodeProps = {
  value: JsonValue
  label: string | number | null
  path: Path
  expanded: Set<string>
  toggle: (id: string) => void
  selectedId: string
  select: (path: Path) => void
  query: string
  matches: Set<string>
  ancestors: Set<string>
  copy: (text: string, label: string) => void
  showAll?: boolean
}

function TreeNode({
  value,
  label,
  path,
  expanded,
  toggle,
  selectedId,
  select,
  query,
  matches,
  ancestors,
  copy,
  showAll = false,
}: TreeNodeProps) {
  const id = pathId(path)
  const container = isContainer(value)
  const children = entriesOf(value)
  const open = expanded.has(id) || (!!query && ancestors.has(id))
  const kind = typeOf(value)
  const isMatch = matches.has(id)
  const includeAll = showAll || isMatch

  return (
    <div className="tree-node" role="none">
      <div
        className={`tree-row ${selectedId === id ? 'selected' : ''} ${isMatch ? 'matched' : ''}`}
        role="treeitem"
        aria-level={path.length + 1}
        aria-selected={selectedId === id}
        aria-expanded={container ? open : undefined}
        tabIndex={0}
        onClick={() => select(path)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            select(path)
          }
          if (container && event.key === 'ArrowRight' && !open) {
            event.preventDefault()
            toggle(id)
          }
          if (container && event.key === 'ArrowLeft' && open) {
            event.preventDefault()
            toggle(id)
          }
        }}
      >
        {container ? (
          <button
            className="branch-toggle"
            type="button"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${label ?? 'root'}`}
            onClick={(event) => {
              event.stopPropagation()
              toggle(id)
            }}
          >
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span className="branch-spacer" />
        )}
        {label === null ? (
          <span className="root-label">root</span>
        ) : (
          <span className={typeof label === 'number' ? 'tree-index' : 'tree-key'}>
            {typeof label === 'number' ? label : JSON.stringify(label)}
          </span>
        )}
        <span className="tree-colon">:</span>
        {container ? (
          <>
            <span className="tree-bracket">{Array.isArray(value) ? '[' : '{'}</span>
            {!open && (
              <span className="collapsed-preview">
                {children.length === 0
                  ? ''
                  : `${children.length} ${Array.isArray(value) ? 'items' : 'keys'}`}
              </span>
            )}
            {!open && <span className="tree-bracket">{Array.isArray(value) ? ']' : '}'}</span>}
            {open && children.length === 0 && (
              <span className="tree-bracket">{Array.isArray(value) ? ']' : '}'}</span>
            )}
          </>
        ) : (
          <span className={`tree-value type-${kind}`}>
            {kind === 'string' ? JSON.stringify(value) : String(value)}
          </span>
        )}
        <span className={`type-pill type-pill-${kind}`}>{kind}</span>
        <button
          className="row-copy"
          type="button"
          aria-label={`Copy value at ${pathAsText(path)}`}
          title="Copy value"
          onClick={(event) => {
            event.stopPropagation()
            copy(valueAsText(value), 'Value copied')
          }}
        >
          <Copy size={14} />
        </button>
      </div>
      {container && open && children.length > 0 && (
        <div className="tree-children" role="group">
          {children
            .filter(
              ([key]) =>
                !query ||
                includeAll ||
                matches.has(pathId([...path, key])) ||
                ancestors.has(pathId([...path, key])),
            )
            .map(([key, child]) => (
              <TreeNode
                key={String(key)}
                value={child}
                label={key}
                path={[...path, key]}
                expanded={expanded}
                toggle={toggle}
                selectedId={selectedId}
                select={select}
                query={query}
                matches={matches}
                ancestors={ancestors}
                copy={copy}
                showAll={includeAll}
              />
            ))}
          <div className="tree-close">{Array.isArray(value) ? ']' : '}'}</div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [input, setInput] = useState(SAMPLE)
  const [value, setValue] = useState<JsonValue>(INITIAL_VALUE)
  const [hasParsed, setHasParsed] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [issue, setIssue] = useState<ParseIssue | null>(null)
  const [expanded, setExpanded] = useState(() => initialExpanded(INITIAL_VALUE))
  const [selectedPath, setSelectedPath] = useState<Path>([])
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stats = useMemo(() => (hasParsed ? countData(value) : null), [hasParsed, value])
  const search = useMemo(
    () =>
      hasParsed
        ? findMatches(value, query)
        : { matches: new Set<string>(), ancestors: new Set<string>() },
    [hasParsed, value, query],
  )
  const selectedValue = hasParsed ? getAtPath(value, selectedPath) : null

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2400)
  }

  async function copy(text: string, label = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text)
      showToast(label)
    } catch {
      showToast('Clipboard access is unavailable')
    }
  }

  function parse(source = input) {
    try {
      const parsed = JSON.parse(source) as JsonValue
      setValue(parsed)
      setHasParsed(true)
      setDirty(false)
      setIssue(null)
      setExpanded(initialExpanded(parsed))
      setSelectedPath([])
      setQuery('')
      showToast('JSON parsed successfully')
    } catch (error) {
      setIssue(getIssue(error, source))
      setHasParsed(false)
      setDirty(false)
    }
  }

  function transform(pretty: boolean) {
    try {
      const parsed = JSON.parse(input) as JsonValue
      setInput(JSON.stringify(parsed, null, pretty ? 2 : undefined))
      setIssue(null)
      setDirty(true)
      showToast(pretty ? 'JSON formatted' : 'JSON minified')
    } catch (error) {
      setIssue(getIssue(error, input))
    }
  }

  function reset() {
    setInput(SAMPLE)
    setValue(INITIAL_VALUE)
    setHasParsed(true)
    setDirty(false)
    setIssue(null)
    setExpanded(initialExpanded(INITIAL_VALUE))
    setSelectedPath([])
    setQuery('')
    showToast('Sample restored')
  }

  function clear() {
    setInput('')
    setHasParsed(false)
    setDirty(false)
    setIssue(null)
    setSelectedPath([])
    setQuery('')
  }

  async function importFile(file?: File) {
    if (!file) return
    const text = await file.text()
    setInput(text)
    parse(text)
  }

  function download() {
    if (!hasParsed) return
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  function toggle(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="JSON Atlas home">
          <span className="brand-mark">
            <Braces size={23} strokeWidth={2.5} />
          </span>
          <span>
            json<span className="brand-accent">atlas</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-right">
          <span className="privacy-note">
            <ShieldCheck size={16} /> Your data stays in this browser
          </span>
          <a
            className="github-link"
            href="https://github.com/zjzhou521/json-treeview-online-tool"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main id="top">
        <section className="intro">
          <div className="eyebrow">
            <span className="eyebrow-line" /> THE JSON WORKSPACE{' '}
            <span className="version-tag">v1.0</span>
          </div>
          <div className="intro-grid">
            <div>
              <h1>
                See the shape
                <br />
                <em>behind the data.</em>
              </h1>
              <p className="intro-copy">
                Paste any valid JSON and turn it into a clean, navigable tree. Trace values, find
                keys, and copy exactly what you need.
              </p>
            </div>
            <div className="hero-decoration" aria-hidden="true">
              <div className="decoration-glow" />
              <div className="decoration-card card-back">
                <span>{'{'}</span>
                <span className="deco-line" />
                <span className="deco-line short" />
                <span>{'}'}</span>
              </div>
              <div className="decoration-card card-front">
                <span className="deco-node root-node" />
                <span className="deco-branch">
                  <i />
                  <b />
                  <i />
                </span>
                <span className="deco-branch last">
                  <i />
                  <b />
                  <i />
                </span>
              </div>
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
            </div>
          </div>
        </section>

        <section className="workspace" aria-label="JSON workspace">
          <div className="workspace-heading">
            <div>
              <span className="section-number">01 / WORKSPACE</span>
              <h2>Explore your JSON</h2>
            </div>
            <span className="workspace-hint">
              <Sparkles size={15} /> Start with the sample, or bring your own data
            </span>
          </div>
          <div className="panel-grid">
            <section className="panel editor-panel" aria-label="JSON input">
              <div className="panel-header">
                <div className="panel-title">
                  <span className="panel-icon orange">
                    <Code2 size={18} />
                  </span>
                  <div>
                    <strong>Input</strong>
                    <small>Raw JSON</small>
                  </div>
                </div>
                <div className="panel-header-actions">
                  <button
                    type="button"
                    className="text-action"
                    onClick={reset}
                    title="Restore sample"
                  >
                    <RotateCcw size={15} /> Sample
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={clear}
                    title="Clear input"
                    aria-label="Clear input"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>
              <div className="editor-toolbar">
                <span className="toolbar-label">
                  <span className="live-dot" /> EDITOR
                </span>
                <div className="toolbar-actions">
                  <button type="button" onClick={() => transform(true)}>
                    <WandSparkles size={14} /> Format
                  </button>
                  <button type="button" onClick={() => transform(false)}>
                    <Minimize2 size={14} /> Minify
                  </button>
                </div>
              </div>
              <label className="sr-only" htmlFor="json-input">
                Paste JSON here
              </label>
              <textarea
                id="json-input"
                spellCheck={false}
                value={input}
                placeholder={'{\n  "hello": "world"\n}'}
                onChange={(event) => {
                  setInput(event.target.value)
                  setDirty(true)
                  setIssue(null)
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault()
                    parse()
                  }
                }}
              />
              {issue && (
                <div className="parse-error" role="alert">
                  <strong>Could not parse JSON</strong>
                  <span>
                    {issue.location ? `${issue.location} · ` : ''}
                    {issue.message}
                  </span>
                </div>
              )}
              <div className="editor-footer">
                <div className="editor-utilities">
                  <input
                    ref={fileRef}
                    className="sr-only"
                    type="file"
                    accept=".json,application/json,text/plain"
                    onChange={(event) => {
                      void importFile(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                  <button type="button" onClick={() => fileRef.current?.click()}>
                    <FileUp size={15} /> Open file
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText()
                        setInput(text)
                        parse(text)
                      } catch {
                        showToast('Clipboard access is unavailable')
                      }
                    }}
                  >
                    <Clipboard size={15} /> Paste
                  </button>
                </div>
                <span className="character-count">{input.length.toLocaleString()} chars</span>
              </div>
              <div className="parse-bar">
                <span
                  className={`parse-status ${issue ? 'invalid' : dirty ? 'pending' : hasParsed ? 'valid' : ''}`}
                >
                  {issue
                    ? 'Invalid JSON'
                    : dirty
                      ? 'Ready to parse'
                      : hasParsed
                        ? 'Valid JSON'
                        : 'No JSON loaded'}
                </span>
                <button type="button" className="primary-button" onClick={() => parse()}>
                  <Play size={15} fill="currentColor" /> Parse JSON{' '}
                  <span className="shortcut">⌘ ↵</span>
                </button>
              </div>
            </section>

            <section className="panel viewer-panel" aria-label="Interactive JSON tree">
              <div className="panel-header">
                <div className="panel-title">
                  <span className="panel-icon teal">
                    <FileJson2 size={18} />
                  </span>
                  <div>
                    <strong>Tree view</strong>
                    <small>Explore the structure</small>
                  </div>
                </div>
                <div className="panel-header-actions">
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => copy(valueAsText(value), 'JSON copied')}
                    disabled={!hasParsed}
                    title="Copy parsed JSON"
                    aria-label="Copy parsed JSON"
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={download}
                    disabled={!hasParsed}
                    title="Download JSON"
                    aria-label="Download JSON"
                  >
                    <Download size={17} />
                  </button>
                </div>
              </div>
              <div className="viewer-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search keys and values"
                    placeholder="Search keys or values..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    disabled={!hasParsed}
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="tree-actions">
                  <button
                    type="button"
                    title="Expand all"
                    aria-label="Expand all"
                    onClick={() => setExpanded(allExpandable(value))}
                    disabled={!hasParsed}
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button
                    type="button"
                    title="Collapse all"
                    aria-label="Collapse all"
                    onClick={() => setExpanded(new Set([pathId([])]))}
                    disabled={!hasParsed}
                  >
                    <FoldVertical size={16} />
                  </button>
                </div>
              </div>
              <div className="tree-surface">
                {hasParsed && (!query || search.matches.size > 0) ? (
                  <div className="tree-content" role="tree" aria-label="JSON tree">
                    <TreeNode
                      value={value}
                      label={null}
                      path={[]}
                      expanded={expanded}
                      toggle={toggle}
                      selectedId={pathId(selectedPath)}
                      select={setSelectedPath}
                      query={query}
                      matches={search.matches}
                      ancestors={search.ancestors}
                      copy={copy}
                    />
                  </div>
                ) : hasParsed ? (
                  <div className="empty-state">
                    <Search size={26} />
                    <strong>No matching nodes</strong>
                    <span>Try a different key or value.</span>
                  </div>
                ) : (
                  <div className="empty-state">
                    <FileJson2 size={28} />
                    <strong>Nothing to explore yet</strong>
                    <span>Paste valid JSON and press Parse JSON.</span>
                  </div>
                )}
              </div>
              <div className="inspector">
                <div className="inspector-heading">
                  <span>SELECTED PATH</span>
                  <span className="inspector-type">{hasParsed ? typeOf(selectedValue) : '—'}</span>
                </div>
                <div className="inspector-path">
                  <code>{hasParsed ? pathAsText(selectedPath) : '—'}</code>
                  <button
                    type="button"
                    disabled={!hasParsed}
                    onClick={() => copy(pathAsText(selectedPath), 'Path copied')}
                    aria-label="Copy selected path"
                    title="Copy path"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </div>
            </section>
          </div>
          <div className="summary-strip">
            <div className="summary-intro">
              <span className="summary-icon">
                <Braces size={19} />
              </span>
              <span>Structure at a glance</span>
            </div>
            <div className="summary-stat">
              <strong>{stats?.nodes.toLocaleString() ?? '—'}</strong>
              <span>nodes</span>
            </div>
            <div className="summary-stat">
              <strong>{stats?.objects.toLocaleString() ?? '—'}</strong>
              <span>objects</span>
            </div>
            <div className="summary-stat">
              <strong>{stats?.arrays.toLocaleString() ?? '—'}</strong>
              <span>arrays</span>
            </div>
            <div className="summary-stat">
              <strong>{stats?.depth.toLocaleString() ?? '—'}</strong>
              <span>max depth</span>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="info-kicker">BUILT FOR CLARITY</div>
          <h2>From raw text to real understanding.</h2>
          <div className="feature-grid">
            <article>
              <div className="feature-icon">
                <ChevronRight size={21} />
              </div>
              <h3>Follow every branch</h3>
              <p>
                Open and close objects or arrays to focus on the part of your data that matters.
              </p>
            </article>
            <article>
              <div className="feature-icon">
                <Search size={21} />
              </div>
              <h3>Find it fast</h3>
              <p>
                Search keys and values. Matching paths open automatically, even deep in the tree.
              </p>
            </article>
            <article>
              <div className="feature-icon">
                <Copy size={21} />
              </div>
              <h3>Take what you need</h3>
              <p>
                Copy a node, its JSON path, or the whole document. Download clean JSON any time.
              </p>
            </article>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          json<span>atlas</span>.
        </span>
        <span>Made for curious data explorers.</span>
        <span>
          <ShieldCheck size={14} /> Everything runs locally in your browser.
        </span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  )
}
