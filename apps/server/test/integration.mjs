// 集成测试：node test/integration.mjs（需先后台起服务：pnpm --filter @collab/server start:dev）
// 覆盖：登录 → 建文档 → 取 ticket → 两个 yjs 客户端（yjs+ws 直连 3001）并发插入 → 收敛 →
//       第三方客户端断言三方向一致 → REST 评论 CRUD → resolve 断言第三方客户端收到 Mark 更新。
// 客户端用 raw ws + y-protocols 实现最小 yjs 客户端（等价 y-websocket 客户端协议行为，避免引入 y-websocket 依赖）。
import WebSocket from 'ws'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'

const BASE = process.env.COLLAB_SERVER_URL ?? 'http://localhost:3000'
const WS_BASE = process.env.COLLAB_WS_URL ?? 'ws://localhost:3001'
const USERNAME = process.env.ADMIN_USERNAME ?? 'admin'
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123'

const failures = []
function ok(name, cond, extra = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    console.log(`  ✗ ${name}${extra ? ` (${extra})` : ''}`)
    failures.push(name)
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitReady() {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
      })
      if (r.ok) return
    } catch {
      /* 服务端未就绪 */
    }
    await sleep(200)
  }
  throw new Error(`服务端未就绪（${BASE}），请先运行 pnpm --filter @collab/server start:dev`)
}

async function api(method, path, { token, body } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, json }
}

// 最小 yjs 客户端：raw ws + y-protocols
function connectYjsClient(url, doc) {
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'
  const updateHandler = (update, origin) => {
    if (origin !== ws) {
      const enc = encoding.createEncoder()
      encoding.writeVarUint(enc, 0)
      syncProtocol.writeUpdate(enc, update)
      ws.send(encoding.toUint8Array(enc))
    }
  }
  doc.on('update', updateHandler)
  ws.on('open', () => {
    const enc = encoding.createEncoder()
    encoding.writeVarUint(enc, 0)
    syncProtocol.writeSyncStep1(enc, doc)
    ws.send(encoding.toUint8Array(enc))
  })
  ws.on('message', (data) => {
    const enc = encoding.createEncoder()
    const dec = decoding.createDecoder(new Uint8Array(data))
    const type = decoding.readVarUint(dec)
    if (type === 0) {
      encoding.writeVarUint(enc, 0)
      syncProtocol.readSyncMessage(dec, enc, doc, ws)
      if (encoding.length(enc) > 1) ws.send(encoding.toUint8Array(enc))
    }
    // type=1 awareness / type=3 queryAwareness / type=100 评论活动帧：忽略（此测试用不到）
  })
  return ws
}

function waitOpen(ws) {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve()
    ws.once('open', resolve)
    ws.once('error', reject)
    ws.once('close', (code) => reject(new Error(`ws 关闭 code=${code}`)))
  })
}

// 在 'default' XmlFragment 下插入一个段落（对齐 y-tiptap 文档结构）
function insertParagraph(doc, text, markAttrs) {
  const frag = doc.getXmlFragment('default')
  const p = new Y.XmlElement('paragraph')
  const t = new Y.XmlText()
  t.insert(0, text, markAttrs ? { comment: markAttrs } : undefined)
  p.insert(0, [t])
  frag.push([p])
}

// 递归读取 'default' 下全部文本
function readText(doc) {
  let out = ''
  const walk = (root) => {
    if (root instanceof Y.Text) {
      out += root.toString()
      return
    }
    if (root instanceof Y.XmlFragment || root instanceof Y.XmlElement) {
      for (const c of root.toArray()) walk(c)
    }
  }
  walk(doc.getXmlFragment('default'))
  return out
}

// 读取指定 commentId 的 Mark resolved 属性
function readMarkResolved(doc, commentId) {
  let result
  const walk = (root) => {
    if (root instanceof Y.Text) {
      const delta = root.toDelta()
      for (const d of delta) {
        const attr = d.attributes?.comment
        if (attr && typeof attr === 'object' && attr.commentId === commentId) {
          result = attr.resolved
        }
      }
      return
    }
    if (root instanceof Y.XmlFragment || root instanceof Y.XmlElement) {
      for (const c of root.toArray()) walk(c)
    }
  }
  walk(doc.getXmlFragment('default'))
  return result
}

async function main() {
  await waitReady()
  console.log('1. 登录 / 建文档 / 取 ticket')

  const login = await api('POST', '/api/auth/login', {
    body: { username: USERNAME, password: PASSWORD },
  })
  ok('登录', login.status === 201 && !!login.json?.token)
  const token = login.json.token

  const doc = await api('POST', '/api/docs', { token, body: { title: '集成测试文档' } })
  ok('建文档', doc.status === 201 && !!doc.json?.id)
  const docId = doc.json.id

  const t1 = await api('POST', '/api/collab/ticket', { token })
  const t2 = await api('POST', '/api/collab/ticket', { token })
  const t3 = await api('POST', '/api/collab/ticket', { token })
  ok('取 ticket', t1.status === 201 && !!t1.json?.ticket)

  console.log('2. 双客户端并发插入 → 收敛 → 第三方断言一致')
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  const docC = new Y.Doc()

  const wsA = connectYjsClient(`${WS_BASE}/${docId}?ticket=${t1.json.ticket}`, docA)
  const wsB = connectYjsClient(`${WS_BASE}/${docId}?ticket=${t2.json.ticket}`, docB)
  await Promise.all([waitOpen(wsA), waitOpen(wsB)])
  await sleep(300) // 首轮 sync step1/step2 握手

  insertParagraph(docA, 'AAAA')
  insertParagraph(docB, 'BBBB')
  await sleep(600)

  ok('A/B 双端收敛', readText(docA) === readText(docB), `${readText(docA)} vs ${readText(docB)}`)

  const wsC = connectYjsClient(`${WS_BASE}/${docId}?ticket=${t3.json.ticket}`, docC)
  await waitOpen(wsC)
  await sleep(600)
  ok(
    '三方向一致（服务端权威）',
    readText(docC) === readText(docA),
    `${readText(docC)} vs ${readText(docA)}`,
  )

  console.log('3. REST 评论 CRUD')
  const created = await api('POST', `/api/docs/${docId}/comments`, {
    token,
    body: { content: '第一条评论', anchor: { start: '0', end: '4', quote: 'AAAA' } },
  })
  ok('创建评论', created.status === 201 && !!created.json?.id)
  const commentId = created.json.id

  const reply = await api('POST', `/api/docs/${docId}/comments`, {
    token,
    body: { content: '这是一条回复', parentId: commentId },
  })
  ok('创建回复', reply.status === 201 && reply.json?.parentId === commentId)

  const list = await api('GET', `/api/docs/${docId}/comments`, { token })
  ok(
    '评论列表平铺（含 author + parentId）',
    list.status === 200 && Array.isArray(list.json) && list.json.length === 2 && !!list.json[0].author?.username,
  )

  console.log('4. 客户端本地加 Mark（走 CRDT）→ resolve 收口 → 第三方收到 Mark 更新')
  // 客户端 A 本地加评论 Mark（commentId = 服务端返回的评论 id），走 CRDT 同步到服务端与 C
  insertParagraph(docA, '被评论的文本', { commentId, resolved: false })
  await sleep(600)

  const resolved = await api('PATCH', `/api/comments/${commentId}`, { token, body: { resolved: true } })
  ok('解决评论', resolved.status === 200 && resolved.json?.resolved === true)
  await sleep(600)
  ok('第三方客户端收到 Mark resolved=true', readMarkResolved(docC, commentId) === true)

  console.log('5. 删除评论（级联删回复）')
  const del = await api('DELETE', `/api/comments/${commentId}`, { token })
  ok('删除评论 204', del.status === 204)
  const listAfter = await api('GET', `/api/docs/${docId}/comments`, { token })
  ok('删除后列表为空', listAfter.status === 200 && listAfter.json.length === 0)

  wsA.close()
  wsB.close()
  wsC.close()

  console.log('')
  if (failures.length === 0) {
    console.log('PASS: 全部集成断言通过')
    process.exit(0)
  } else {
    console.log(`FAIL: ${failures.length} 项断言失败 → ${failures.join('; ')}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('集成测试异常：', err)
  process.exit(1)
})
