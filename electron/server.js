const Koa = require('koa')
const bodyParser = require('koa-bodyparser')

const app = new Koa()
const port = 17334

// 使用 bodyParser 中间件解析 JSON
app.use(bodyParser())

// Hello World 路由
app.use(async (ctx) => {
  if (ctx.path === '/') {
    ctx.body = { message: 'Hello World from DevHaven!' }
  }
})

// 启动服务器
function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Koa server is running on http://localhost:${port}`)
      resolve(server)
    })
  })
}

module.exports = { startServer }
