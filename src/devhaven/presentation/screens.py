from __future__ import annotations

from pathlib import Path

from textual.app import ComposeResult
from textual.containers import Container, Horizontal
from textual.screen import ModalScreen
from textual.widgets import Button, DirectoryTree, Input, Label, Static

from devhaven.domain import Project
from devhaven.presentation.types import ImportDirectoryResult, ProjectFormResult


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
