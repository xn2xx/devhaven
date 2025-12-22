from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shlex
import sys

from devhaven.domain import DEFAULT_SPACE
from devhaven.infrastructure.config_store import load_config
from devhaven.infrastructure.project_repository import ProjectRepository


@dataclass(frozen=True)
class ImportSummary:
    added: int
    skipped_existing: int
    skipped_hidden: int
    total_children: int
    space: str


def build_open_command(path: str) -> list[str]:
    config = load_config()
    open_command = str(config.get("open_command", "") or "").strip()
    path_value = Path(path).expanduser().resolve().as_posix()
    if open_command:
        tokens = shlex.split(open_command)
        if any("{path}" in token for token in tokens):
            return [token.replace("{path}", path_value) for token in tokens]
        return [*tokens, path_value]
    return default_open_command(path_value)


def default_open_command(path: str) -> list[str]:
    if sys.platform.startswith("darwin"):
        return ["open", path]
    if sys.platform.startswith("win"):
        return ["cmd", "/c", "start", "", path]
    return ["xdg-open", path]


def import_projects(
    repository: ProjectRepository,
    parent_path: Path,
    space: str,
    tags: list[str],
) -> ImportSummary:
    if not parent_path.exists() or not parent_path.is_dir():
        raise FileNotFoundError(parent_path)
    children = [child for child in parent_path.iterdir() if child.is_dir()]
    space_value = space.strip() or parent_path.name.strip() or DEFAULT_SPACE
    existing_paths = repository.list_project_paths()
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
        repository.create_project(child.name, path_value, space_value, tags)
        existing_paths.add(path_value)
        added += 1
    return ImportSummary(
        added=added,
        skipped_existing=skipped_existing,
        skipped_hidden=skipped_hidden,
        total_children=len(children),
        space=space_value,
    )
