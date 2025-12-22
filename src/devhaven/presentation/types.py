from __future__ import annotations

from dataclasses import dataclass


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
