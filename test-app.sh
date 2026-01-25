#!/bin/bash

# 测试脚本：启动应用并查看调试输出

echo "启动 DevHaven 应用..."
echo "查看控制台输出以诊断问题"
echo "================================"

# 直接运行二进制文件，可以看到 stderr 输出
/Users/zhaotianzeng/WebstormProjects/DevHaven/src-tauri/target/release/tauri-app 2>&1 | tee /tmp/devhaven-debug.log
