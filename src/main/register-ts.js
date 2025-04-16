// 注册 TypeScript 支持
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true
  }
});

// 引入主进程入口
require('./index.js');
