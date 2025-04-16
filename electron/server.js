const express = require('express')

const app = express()
const port = 3000

// 启用 JSON 解析
app.use(express.json())

// Hello World 路由
app.get('/', (req, res) => {
  res.json({ message: 'Hello World from DevHaven!' })
})

// 启动服务器
function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Express server is running on http://localhost:${port}`)
      resolve(server)
    })
  })
}

module.exports = { startServer }
