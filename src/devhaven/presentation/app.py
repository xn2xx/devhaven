from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

from rich.columns import Columns
from rich.console import Group
from rich.panel import Panel
from rich.text import Text
from textual import app as textual_app
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, VerticalScroll
from textual.theme import BUILTIN_THEMES
from textual.widgets import Footer, Header, Input, Static, Tree

from devhaven.application.project_service import build_open_command, import_projects
from devhaven.domain import Project
from devhaven.infrastructure.project_repository import ProjectRepository
from devhaven.presentation.screens import (
    ConfirmDelete,
    ImportDirectoryForm,
    MessageScreen,
    ProjectForm,
)
from devhaven.presentation.terminal import ProjectTerminal
from devhaven.presentation.types import ImportDirectoryResult, ProjectFormResult, TreeItem

if not hasattr(textual_app, "DEFAULT_COLORS"):
    textual_app.DEFAULT_COLORS = {
        "dark": BUILTIN_THEMES["textual-dark"].to_color_system(),
        "light": BUILTIN_THEMES["textual-light"].to_color_system(),
    }


class DevHavenApp(App):
    CSS = """
    #body {
        height: 1fr;
    }

    #sidebar {
        width: 40%;
        min-width: 30;
        border-right: solid $primary;
    }

    #detail_panel {
        width: 1fr;
        padding: 1 2;
    }

    #search {
        margin: 1 1 0 1;
    }

    #project_tree {
        height: 1fr;
        margin: 1;
    }

    #detail_scroll {
        border: solid $secondary;
        padding: 1;
        height: 2fr;
    }

    #detail {
        height: auto;
    }

    #terminal_panel {
        border: solid $secondary;
        padding: 0 1;
        margin-top: 1;
        height: 1fr;
    }

    #terminal {
        height: 1fr;
    }
    """

    BINDINGS = [
        ("q", "quit", "退出"),
        ("a", "add_project", "新增"),
        ("e", "edit_project", "编辑"),
        ("d", "delete_project", "删除"),
        ("i", "import_projects", "导入"),
        ("o", "open_project", "打开"),
        ("enter", "open_project", "打开"),
        ("r", "refresh", "刷新"),
        ("/", "focus_search", "搜索"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.repository = ProjectRepository()
        self.projects: list[Project] = []
        self.project_map: dict[int, Project] = {}
        self.space_counts: dict[str, int] = {}
        self.selected_project_id: int | None = None
        self.selected_space: str | None = None
        self.query_text = ""

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="body"):
            with Vertical(id="sidebar"):
                yield Input(placeholder="搜索", id="search")
                tree = Tree("空间", id="project_tree")
                tree.show_root = False
                yield tree
            with Vertical(id="detail_panel"):
                with VerticalScroll(id="detail_scroll"):
                    yield Static("未选择项目。", id="detail")
                with Container(id="terminal_panel"):
                    yield ProjectTerminal(
                        command=self._terminal_command(),
                        id="terminal",
                    )
        yield Footer()

    def on_mount(self) -> None:
        self.repository.ensure_schema()
        self._start_terminal()
        self.refresh_projects()
        self.query_one("#search", Input).focus()

    def _terminal_command(self) -> str:
        if sys.platform.startswith("win"):
            return os.environ.get("COMSPEC", "cmd")
        return os.environ.get("SHELL") or "bash"

    def _start_terminal(self) -> None:
        terminal = self.query_one("#terminal", ProjectTerminal)
        terminal.start()

    def _normalize_terminal_path(self, path: str) -> str:
        resolved = Path(path).expanduser().resolve()
        if sys.platform.startswith("win"):
            return str(resolved)
        return resolved.as_posix()

    def _quote_terminal_path(self, path: str) -> str:
        escaped = path.replace('"', '\\"')
        return f"\"{escaped}\""

    def _build_cd_command(self, path: str) -> str:
        path_value = self._normalize_terminal_path(path)
        quoted = self._quote_terminal_path(path_value)
        if sys.platform.startswith("win"):
            return f"cd /d {quoted}\r\n"
        return f"cd {quoted}\n"

    def _update_terminal_cwd(self, path: str | None) -> None:
        if not path:
            return
        terminal = self.query_one("#terminal", ProjectTerminal)
        if terminal.send_queue is None:
            return
        terminal.send_queue.put_nowait(["stdin", self._build_cd_command(path)])

    def on_input_changed(self, event: Input.Changed) -> None:
        if event.input.id == "search":
            self.refresh_projects(event.value)

    def on_tree_node_selected(self, event: Tree.NodeSelected) -> None:
        self._handle_tree_selection(event.node.data)

    def on_tree_node_highlighted(self, event: Tree.NodeHighlighted) -> None:
        self._handle_tree_selection(event.node.data)

    def action_focus_search(self) -> None:
        self.query_one("#search", Input).focus()

    def action_refresh(self) -> None:
        self.refresh_projects(self.query_text)

    def action_add_project(self) -> None:
        self.push_screen(ProjectForm("新增项目"), self._handle_add_result)

    def action_edit_project(self) -> None:
        project = self.get_selected_project()
        if not project:
            return
        self.push_screen(ProjectForm("编辑项目", project), lambda result: self._handle_edit_result(project.id, result))

    def action_import_projects(self) -> None:
        self.push_screen(ImportDirectoryForm(), self._handle_import_result)

    def action_delete_project(self) -> None:
        project = self.get_selected_project()
        if not project:
            return
        self.push_screen(ConfirmDelete(project.name), lambda confirmed: self._handle_delete_result(project.id, confirmed))

    def action_open_project(self) -> None:
        project = self.get_selected_project()
        if not project:
            return
        try:
            command = build_open_command(project.path)
            subprocess.Popen(command)
        except OSError as exc:
            self.push_screen(MessageScreen("打开失败", str(exc)))
            return
        self.repository.touch_opened(project.id)
        self.refresh_projects(self.query_text)

    def refresh_projects(self, query: str | None = None) -> None:
        if query is not None:
            self.query_text = query
        self.projects = self.repository.list_projects(self.query_text)
        self.project_map = {project.id: project for project in self.projects}
        self.space_counts = {}
        for project in self.projects:
            self.space_counts[project.space] = self.space_counts.get(project.space, 0) + 1

        tree = self.query_one("#project_tree", Tree)
        previous_project = self.selected_project_id
        previous_space = self.selected_space
        tree.clear()
        tree.root.label = "空间"
        tree.root.expand()

        space_nodes: dict[str, object] = {}
        project_nodes: dict[int, object] = {}
        spaces: dict[str, list[Project]] = {}
        for project in self.projects:
            spaces.setdefault(project.space, []).append(project)
        for space in sorted(spaces.keys(), key=lambda item: item.lower()):
            space_node = tree.root.add(space, data=TreeItem.space(space), expand=True)
            space_nodes[space] = space_node
            for project in sorted(spaces[space], key=lambda item: item.name.lower()):
                project_node = space_node.add(project.name, data=TreeItem.project(project.id))
                project_nodes[project.id] = project_node

        if previous_project in project_nodes:
            tree.move_cursor(project_nodes[previous_project])
            self.set_selected_project(previous_project)
            return
        if previous_space in space_nodes:
            tree.move_cursor(space_nodes[previous_space])
            self.set_selected_space(previous_space)
            return
        if project_nodes:
            first_project_id = next(iter(project_nodes.keys()))
            tree.move_cursor(project_nodes[first_project_id])
            self.set_selected_project(first_project_id)
            return
        if space_nodes:
            first_space = next(iter(space_nodes.keys()))
            tree.move_cursor(space_nodes[first_space])
            self.set_selected_space(first_space)
            return
        self.set_selected_project(None)

    def set_selected_project(self, project_id: int | None) -> None:
        self.selected_project_id = project_id
        self.selected_space = None
        project = self.project_map.get(project_id) if project_id is not None else None
        self.update_detail(project)
        if project is not None:
            self._update_terminal_cwd(project.path)

    def set_selected_space(self, space: str | None) -> None:
        self.selected_space = space
        self.selected_project_id = None
        if space is None:
            self.update_detail(None)
            return
        self._render_space_detail(space)

    def update_detail(self, project: Project | None) -> None:
        detail = self.query_one("#detail", Static)
        if project is None:
            detail.update("未选择项目。")
            return
        tags = ", ".join(project.tags) if project.tags else "-"
        last_opened = project.last_opened_at or "-"
        detail.update(
            "\n".join(
                [
                    project.name,
                    "",
                    f"路径：{project.path}",
                    f"空间：{project.space}",
                    f"标签：{tags}",
                    f"上次打开：{last_opened}",
                    f"创建时间：{project.created_at}",
                    f"更新时间：{project.updated_at}",
                ]
            )
        )

    def _render_space_detail(self, space: str) -> None:
        detail = self.query_one("#detail", Static)
        count = self.space_counts.get(space, 0)
        header = Text(f"空间：{space}", style="bold")
        meta = Text(
            "\n".join(
                [
                    f"项目数量：{count}",
                ]
            )
        )
        projects = [project for project in self.projects if project.space == space]
        if projects:
            cards = []
            for project in projects:
                tags = "、".join(project.tags) if project.tags else "无"
                body = Text(f"标签：{tags}", style="dim")
                cards.append(Panel(body, title=project.name, title_align="center", padding=(0, 1)))
            grid = Columns(cards, equal=True, expand=True, padding=(0, 1))
        else:
            grid = Text("当前空间暂无项目。")
        detail.update(Group(header, Text(""), meta, Text(""), grid))

    def get_selected_project(self) -> Project | None:
        if self.selected_project_id is None:
            return None
        return self.project_map.get(self.selected_project_id)

    def _handle_tree_selection(self, data: object) -> None:
        if isinstance(data, TreeItem) and data.kind == "project":
            self.set_selected_project(int(data.value))
            return
        if isinstance(data, TreeItem) and data.kind == "space":
            self.set_selected_space(str(data.value))
            return
        self.set_selected_project(None)

    def _handle_add_result(self, result: ProjectFormResult | None) -> None:
        if result is None:
            return
        self.repository.create_project(result.name, result.path, result.space, result.tags)
        self.refresh_projects(self.query_text)

    def _handle_edit_result(self, project_id: int, result: ProjectFormResult | None) -> None:
        if result is None:
            return
        self.repository.update_project(project_id, result.name, result.path, result.space, result.tags)
        self.refresh_projects(self.query_text)

    def _handle_delete_result(self, project_id: int, confirmed: bool) -> None:
        if not confirmed:
            return
        self.repository.delete_project(project_id)
        self.refresh_projects(self.query_text)

    def _handle_import_result(self, result: ImportDirectoryResult | None) -> None:
        if result is None:
            return
        parent = Path(result.path).expanduser().resolve()
        try:
            summary = import_projects(
                repository=self.repository,
                parent_path=parent,
                space=result.space,
                tags=result.tags,
            )
        except FileNotFoundError:
            self.push_screen(MessageScreen("导入失败", "父目录不存在或不可访问。"))
            return
        if summary.total_children == 0:
            self.push_screen(MessageScreen("导入完成", "未找到子目录。"))
            return
        self.refresh_projects(self.query_text)
        message = (
            f"新增 {summary.added} 个项目，跳过 {summary.skipped_existing} 个已存在项目，"
            f"跳过 {summary.skipped_hidden} 个隐藏目录。"
        )
        self.push_screen(MessageScreen("导入完成", message))
