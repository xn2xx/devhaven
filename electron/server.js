const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const { initDatabase, dbService } = require("../src/main/db.service");
const settingsService = require("../src/main/settings-service");
const Router = require("koa-router");

const app = new Koa();
const router = new Router();
const port = 17334;

// 内存存储
const memoryStore = {
  openProjects: new Map() // 使用 Map 来存储 IDE 和项目的关系
};

// 使用 bodyParser 中间件解析 JSON
app.use(bodyParser());

// Hello World 路由
router.get("/", async (ctx) => {
  ctx.body = { settings: settingsService.getSettings() };
});
// 上报正在运行的项目列表
router.post("/reportOpenProjects", async (ctx) => {
  try {
    const { projects, name: ideName } = ctx.request.body;

    if (!projects || !Array.isArray(projects) || !ideName) {
      ctx.status = 400;
      ctx.body = { error: "无效的请求数据格式" };
      return;
    }

    // 将项目数据平铺并存储
    const flattenedProjects = projects.map(project => ({
      ideName,
      projectPath: project.path
    }));

    // 更新内存存储
    memoryStore.openProjects.set(ideName, flattenedProjects);

    // 返回当前存储的所有项目信息
    const allProjects = Array.from(memoryStore.openProjects.values()).flat();

    ctx.body = {
      success: true,
      message: "项目列表已更新",
      projects: allProjects
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: "处理项目列表失败",
      message: error.message
    };
  }
});

// 获取当前打开的项目列表
router.get("/openProjects", async (ctx) => {
  try {
    const allProjects = Array.from(memoryStore.openProjects.values()).flat();
    ctx.body = {
      success: true,
      projects: allProjects
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: "获取项目列表失败",
      message: error.message
    };
  }
});

// 使用路由中间件
app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Koa server is running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

module.exports = { startServer };
