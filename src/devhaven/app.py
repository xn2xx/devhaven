from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import shlex
import subprocess
import sys

from rich.columns import Columns
from rich.console import Group
from rich.panel import Panel
from rich.text import Text
from textual import app as textual_app
from textual import events
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical, VerticalScroll, Container
from textual.screen import ModalScreen
from textual.theme import BUILTIN_THEMES
from textual.widgets import Button, DirectoryTree, Footer, Header, Input, Label, Static, Tree

if not hasattr(textual_app, "DEFAULT_COLORS"):
    textual_app.DEFAULT_COLORS = {
        "dark": BUILTIN_THEMES["textual-dark"].to_color_system(),
        "light": BUILTIN_THEMES["textual-light"].to_color_system(),
    }

from textual_terminal import Terminal


class ProjectTerminal(Terminal):
    async def on_key(self, event: events.Key) -> None:
        if self.emulator is None:
            return

        if event.key == "ctrl+f1":
            self.app.set_focus(None)
            return

        event.prevent_default()
        event.stop()
        char = self.ctrl_keys.get(event.key)
        if char is None and event.key.startswith("ctrl+"):
            key = event.key.removeprefix("ctrl+")
            if len(key) == 1 and key.isalpha():
                char = chr(ord(key.lower()) - 96)
        if char is None:
            char = event.character
        if char:
            await self.send_queue.put(["stdin", char])

from .config import load_config
from .db import Database, Project


@dataclass(frozen=True)
class ProjectFormResult:
    name: str
    path: str
    space: str
    tags: list[str]


@dataclass(frozen=True)
class ImportDirectoryResult:
    path: str
    space: str
    tags: list[str]


@dataclass(frozen=True)
class TreeItem:
    kind: str
    value: str | int

    @staticmethod
    def space(name: str) -> "TreeItem":
        return TreeItem(kind="space", value=name)

    @staticmethod
    def project(project_id: int) -> "TreeItem":
        return TreeItem(kind="project", value=project_id)


class ProjectForm(ModalScreen[ProjectFormResult | None]):
    CSS = """
    Screen {
        align: center middle;
    }

    #dialog {
        width: 70%;
        max-width: 80;
        border: solid $primary;
        padding: 1 2;
        background: $panel;
    }

    #dialog_title {
        text-style: bold;
        margin-bottom: 1;
    }

    .field {
        margin-bottom: 1;
    }

    .field_row {
        height: auto;
        margin-bottom: 1;
    }

    #path_input {
        width: 1fr;
    }

    #browse_path {
        width: auto;
        margin-left: 1;
    }

    #buttons {
        height: auto;
        margin-top: 1;
        align: center middle;
    }

    #error {
        color: red;
        height: auto;
    }
    """

    def __init__(self, title: str, project: Project | None = None) -> None:
        super().__init__()
        self.title = title
        self.project = project

    def compose(self) -> ComposeResult:
        with Container(id="dialog"):
            yield Static(self.title, id="dialog_title")
            yield Label("名称（留空自动填充）", classes="field")
            yield Input(value=self.project.name if self.project else "", id="name_input")
            yield Label("空间（默认个人）", classes="field")
            yield Input(value=self.project.space if self.project else "", id="space_input")
            yield Label("路径", classes="field")
            with Horizontal(classes="field_row"):
                yield Input(value=self.project.path if self.project else "", id="path_input")
                yield Button("选择目录", id="browse_path")
            yield Label("标签（用英文逗号分隔）", classes="field")
            yield Input(value=", ".join(self.project.tags) if self.project else "", id="tags_input")
            yield Static("", id="error")
            with Horizontal(id="buttons"):
                yield Button("保存", id="save", variant="primary")
                yield Button("取消", id="cancel")

    def on_mount(self) -> None:
        self.query_one("#name_input", Input).focus()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel":
            self.dismiss(None)
            return
        if event.button.id == "browse_path":
            self._open_directory_picker("#path_input")
            return
        if event.button.id != "save":
            return

        name = self.query_one("#name_input", Input).value.strip()
        space_value = self.query_one("#space_input", Input).value.strip()
        path_value = self.query_one("#path_input", Input).value.strip()
        tags_value = self.query_one("#tags_input", Input).value.strip()
        error = self.query_one("#error", Static)

        if not path_value:
            error.update("请填写路径。")
            return

        candidate_path = Path(path_value).expanduser()
        if not candidate_path.exists():
            error.update("路径不存在。")
            return

        if not name:
            name = candidate_path.name.strip()
        if not name:
            error.update("无法从路径推断名称。")
            return

        space = space_value or "个人"
        tags = [item.strip() for item in tags_value.split(",") if item.strip()]
        result = ProjectFormResult(
            name=name,
            path=candidate_path.as_posix(),
            space=space,
            tags=tags,
        )
        self.dismiss(result)

    def _open_directory_picker(self, input_selector: str) -> None:
        input_widget = self.query_one(input_selector, Input)
        current = Path(input_widget.value).expanduser() if input_widget.value else Path.home()
        start_path = current if current.exists() else Path.home()
        self.app.push_screen(
            DirectoryPicker(start_path),
            lambda selected: self._apply_directory_selection(input_selector, selected),
        )

    def _apply_directory_selection(self, input_selector: str, selected: Path | None) -> None:
        if selected is None:
            return
        self.query_one(input_selector, Input).value = selected.as_posix()


class DirectoryPicker(ModalScreen[Path | None]):
    CSS = """
    Screen {
        align: center middle;
    }

    #dialog {
        width: 80%;
        height: 80%;
        border: solid $primary;
        padding: 1;
        background: $panel;
    }

    #tree {
        height: 1fr;
        border: solid $secondary;
        margin-bottom: 1;
    }

    #buttons {
        height: auto;
        align: center middle;
    }
    """

    def __init__(self, start_path: Path) -> None:
        super().__init__()
        self.start_path = start_path
        self.selected_path: Path | None = None

    def compose(self) -> ComposeResult:
        with Container(id="dialog"):
            yield Static("选择目录", id="dialog_title")
            yield DirectoryTree(str(self.start_path), id="tree")
            with Horizontal(id="buttons"):
                yield Button("选择", id="select", variant="primary")
                yield Button("取消", id="cancel")

    def on_directory_tree_directory_selected(self, event: DirectoryTree.DirectorySelected) -> None:
        self.selected_path = event.path

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel":
            self.dismiss(None)
            return
        if event.button.id != "select":
            return
        self.dismiss(self.selected_path)


class ImportDirectoryForm(ModalScreen[ImportDirectoryResult | None]):
    CSS = """
    Screen {
        align: center middle;
    }

    #dialog {
        width: 70%;
        max-width: 80;
        border: solid $primary;
        padding: 1 2;
        background: $panel;
    }

    #dialog_title {
        text-style: bold;
        margin-bottom: 1;
    }

    .field {
        margin-bottom: 1;
    }

    .field_row {
        height: auto;
        margin-bottom: 1;
    }

    #import_path_input {
        width: 1fr;
    }

    #browse_import_path {
        width: auto;
        margin-left: 1;
    }

    #buttons {
        height: auto;
        margin-top: 1;
        align: center middle;
    }

    #error {
        color: red;
        height: auto;
    }
    """

    def __init__(self) -> None:
        super().__init__()

    def compose(self) -> ComposeResult:
        with Container(id="dialog"):
            yield Static("导入目录", id="dialog_title")
            yield Label("父目录（将导入其一层子目录）", classes="field")
            with Horizontal(classes="field_row"):
                yield Input(placeholder="例如：/Users/xxx/Projects", id="import_path_input")
                yield Button("选择目录", id="browse_import_path")
            yield Label("空间（留空自动使用父目录名）", classes="field")
            yield Input(id="import_space_input")
            yield Label("标签（用英文逗号分隔，可选）", classes="field")
            yield Input(id="import_tags_input")
            yield Static("", id="error")
            with Horizontal(id="buttons"):
                yield Button("导入", id="import", variant="primary")
                yield Button("取消", id="cancel")

    def on_mount(self) -> None:
        self.query_one("#import_path_input", Input).focus()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel":
            self.dismiss(None)
            return
        if event.button.id == "browse_import_path":
            self._open_directory_picker("#import_path_input")
            return
        if event.button.id != "import":
            return

        path_value = self.query_one("#import_path_input", Input).value.strip()
        space_value = self.query_one("#import_space_input", Input).value.strip()
        tags_value = self.query_one("#import_tags_input", Input).value.strip()
        error = self.query_one("#error", Static)

        if not path_value:
            error.update("请填写父目录路径。")
            return

        candidate_path = Path(path_value).expanduser()
        if not candidate_path.exists() or not candidate_path.is_dir():
            error.update("父目录不存在或不是文件夹。")
            return

        tags = [item.strip() for item in tags_value.split(",") if item.strip()]
        result = ImportDirectoryResult(path=candidate_path.as_posix(), space=space_value, tags=tags)
        self.dismiss(result)

    def _open_directory_picker(self, input_selector: str) -> None:
        input_widget = self.query_one(input_selector, Input)
        current = Path(input_widget.value).expanduser() if input_widget.value else Path.home()
        start_path = current if current.exists() else Path.home()
        self.app.push_screen(
            DirectoryPicker(start_path),
            lambda selected: self._apply_directory_selection(input_selector, selected),
        )

    def _apply_directory_selection(self, input_selector: str, selected: Path | None) -> None:
        if selected is None:
            return
        self.query_one(input_selector, Input).value = selected.as_posix()


class ConfirmDelete(ModalScreen[bool]):
    CSS = """
    Screen {
        align: center middle;
    }

    #dialog {
        width: 60%;
        max-width: 70;
        border: solid $warning;
        padding: 1 2;
        background: $panel;
    }

    #buttons {
        height: auto;
        margin-top: 1;
        align: center middle;
    }
    """

    def __init__(self, project_name: str) -> None:
        super().__init__()
        self.project_name = project_name

    def compose(self) -> ComposeResult:
        with Container(id="dialog"):
            yield Static(f"确定删除项目“{self.project_name}”？")
            with Horizontal(id="buttons"):
                yield Button("删除", id="delete", variant="error")
                yield Button("取消", id="cancel")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "delete":
            self.dismiss(True)
        else:
            self.dismiss(False)


class MessageScreen(ModalScreen[None]):
    CSS = """
    Screen {
        align: center middle;
    }

    #dialog {
        width: 70%;
        max-width: 80;
        border: solid $primary;
        padding: 1 2;
        background: $panel;
    }

    #buttons {
        height: auto;
        margin-top: 1;
        align: center middle;
    }
    """

    def __init__(self, title: str, message: str) -> None:
        super().__init__()
        self.title = title
        self.message = message

    def compose(self) -> ComposeResult:
        with Container(id="dialog"):
            yield Static(self.title, id="dialog_title")
            yield Static(self.message)
            with Horizontal(id="buttons"):
                yield Button("确定", id="ok", variant="primary")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.dismiss(None)


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
        self.db = Database()
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
        self.db.ensure_schema()
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
            command = self.build_open_command(project.path)
            subprocess.Popen(command)
        except OSError as exc:
            self.push_screen(MessageScreen("打开失败", str(exc)))
            return
        self.db.touch_opened(project.id)
        self.refresh_projects(self.query_text)

    def refresh_projects(self, query: str | None = None) -> None:
        if query is not None:
            self.query_text = query
        self.projects = self.db.list_projects(self.query_text)
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
        self.db.create_project(result.name, result.path, result.space, result.tags)
        self.refresh_projects(self.query_text)

    def _handle_edit_result(self, project_id: int, result: ProjectFormResult | None) -> None:
        if result is None:
            return
        self.db.update_project(project_id, result.name, result.path, result.space, result.tags)
        self.refresh_projects(self.query_text)

    def _handle_delete_result(self, project_id: int, confirmed: bool) -> None:
        if not confirmed:
            return
        self.db.delete_project(project_id)
        self.refresh_projects(self.query_text)

    def _handle_import_result(self, result: ImportDirectoryResult | None) -> None:
        if result is None:
            return
        parent = Path(result.path).expanduser().resolve()
        if not parent.exists() or not parent.is_dir():
            self.push_screen(MessageScreen("导入失败", "父目录不存在或不可访问。"))
            return
        children = [child for child in parent.iterdir() if child.is_dir()]
        if not children:
            self.push_screen(MessageScreen("导入完成", "未找到子目录。"))
            return
        space = result.space.strip() or parent.name.strip() or "个人"
        existing_paths = self.db.list_project_paths()
        added = 0
        skipped_existing = 0
        skipped_hidden = 0
        for child in sorted(children, key=lambda item: item.name.lower()):
            if child.name.startswith("."):
                skipped_hidden += 1
                continue
            path_value = child.resolve().as_posix()
            if path_value in existing_paths:
                skipped_existing += 1
                continue
            self.db.create_project(child.name, path_value, space, result.tags)
            existing_paths.add(path_value)
            added += 1
        self.refresh_projects(self.query_text)
        message = (
            f"新增 {added} 个项目，跳过 {skipped_existing} 个已存在项目，"
            f"跳过 {skipped_hidden} 个隐藏目录。"
        )
        self.push_screen(MessageScreen("导入完成", message))

    def build_open_command(self, path: str) -> list[str]:
        config = load_config()
        open_command = str(config.get("open_command", "") or "").strip()
        path_value = Path(path).expanduser().resolve().as_posix()
        if open_command:
            tokens = shlex.split(open_command)
            if any("{path}" in token for token in tokens):
                return [token.replace("{path}", path_value) for token in tokens]
            return [*tokens, path_value]
        return self.default_open_command(path_value)

    def default_open_command(self, path: str) -> list[str]:
        if sys.platform.startswith("darwin"):
            return ["open", path]
        if sys.platform.startswith("win"):
            return ["cmd", "/c", "start", "", path]
        return ["xdg-open", path]
