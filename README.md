# DevHaven TUI

一个基于 Textual 的本地项目管理 TUI。

## 运行环境
- Python 3.10+
- uv

## 安装

创建虚拟环境并安装依赖：

```bash
uv venv
uv pip install -e ".[dev]"
```

启动：

```bash
python -m devhaven
```

## 快捷键
- `a` 新增项目
- `e` 编辑项目
- `d` 删除项目
- `i` 导入目录（一键导入父目录下一层子目录）
- `o` 打开项目
- `/` 搜索
- `空格` 展开/收起空间节点
- `q` 退出

## 路径输入更省心
- 新增/编辑项目时，点击“选择目录”可直接浏览文件夹
- 名称留空会自动使用所选路径的文件夹名

## 空间（分组）
- 空间用于分类项目，默认值为“个人”
- 导入目录时，空间会自动使用父目录名（可手动覆盖）
- 左侧以“空间 -> 项目”的层级结构展示

## 数据位置
- 配置与数据：`~/.devhaven/config.json`

## 配置说明

示例（JSON）：

```json
{
  "open_command": "code {path}",
  "projects": [],
  "next_project_id": 1
}
```

如果 `open_command` 为空或缺失，则使用系统默认打开方式。
