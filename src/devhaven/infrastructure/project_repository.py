from __future__ import annotations

from typing import Any, Iterable

from devhaven.domain import Project, now_iso, normalize_space, normalize_tags
from devhaven.infrastructure.config_store import load_config, save_config


class ProjectRepository:
    def ensure_schema(self) -> None:
        config = self._load_state()
        save_config(config)

    def list_projects(self, query: str = "") -> list[Project]:
        config = self._load_state()
        projects = [project for project in self._load_projects(config) if project is not None]
        query = query.strip().lower()
        if query:
            projects = [project for project in projects if self._matches_query(project, query)]
        projects = sorted(projects, key=lambda item: item.name.lower())
        projects = sorted(projects, key=lambda item: item.last_opened_at or "", reverse=True)
        return projects

    def list_project_paths(self) -> set[str]:
        config = self._load_state()
        paths: set[str] = set()
        for item in config["projects"]:
            if not isinstance(item, dict):
                continue
            path = item.get("path")
            if isinstance(path, str) and path:
                paths.add(path)
        return paths

    def get_project(self, project_id: int) -> Project | None:
        config = self._load_state()
        for item in config["projects"]:
            project = self._project_from_dict(item)
            if project and project.id == project_id:
                return project
        return None

    def create_project(self, name: str, path: str, space: str, tags: Iterable[str]) -> None:
        config = self._load_state()
        now = now_iso()
        project_id = config["next_project_id"]
        config["next_project_id"] = project_id + 1
        config["projects"].append(
            {
                "id": project_id,
                "name": name,
                "path": path,
                "space": normalize_space(space),
                "tags": normalize_tags(tags),
                "created_at": now,
                "updated_at": now,
                "last_opened_at": None,
            }
        )
        save_config(config)

    def update_project(self, project_id: int, name: str, path: str, space: str, tags: Iterable[str]) -> None:
        config = self._load_state()
        project = self._find_project(config["projects"], project_id)
        if project is None:
            return
        project["name"] = name
        project["path"] = path
        project["space"] = normalize_space(space)
        project["tags"] = normalize_tags(tags)
        project["updated_at"] = now_iso()
        save_config(config)

    def delete_project(self, project_id: int) -> None:
        config = self._load_state()
        original = config["projects"]
        config["projects"] = [
            item for item in original if not (isinstance(item, dict) and self._project_id(item) == project_id)
        ]
        if len(config["projects"]) != len(original):
            save_config(config)

    def touch_opened(self, project_id: int) -> None:
        config = self._load_state()
        project = self._find_project(config["projects"], project_id)
        if project is None:
            return
        now = now_iso()
        project["last_opened_at"] = now
        project["updated_at"] = now
        save_config(config)

    def _load_state(self) -> dict[str, Any]:
        config = load_config()
        projects = config.get("projects")
        if not isinstance(projects, list):
            projects = []
        config["projects"] = projects
        next_id = config.get("next_project_id")
        if not isinstance(next_id, int) or next_id < 1:
            next_id = self._next_project_id(projects)
        config["next_project_id"] = next_id
        return config

    def _load_projects(self, config: dict[str, Any]) -> list[Project | None]:
        return [self._project_from_dict(item) for item in config["projects"]]

    def _project_from_dict(self, data: Any) -> Project | None:
        if not isinstance(data, dict):
            return None
        try:
            project_id = int(data.get("id"))
        except (TypeError, ValueError):
            return None
        name = str(data.get("name", "")).strip()
        path = str(data.get("path", "")).strip()
        if not name or not path:
            return None
        space = normalize_space(str(data.get("space", "")))
        tags = self._coerce_tags(data.get("tags"))
        created_at = str(data.get("created_at") or now_iso())
        updated_at = str(data.get("updated_at") or created_at)
        last_opened_at = data.get("last_opened_at")
        last_opened = str(last_opened_at) if last_opened_at else None
        return Project(
            id=project_id,
            name=name,
            path=path,
            space=space,
            tags=tags,
            created_at=created_at,
            updated_at=updated_at,
            last_opened_at=last_opened,
        )

    def _coerce_tags(self, value: Any) -> list[str]:
        if isinstance(value, list):
            return normalize_tags(value)
        if isinstance(value, str):
            return normalize_tags([item for item in value.split(",")])
        return []

    def _matches_query(self, project: Project, query: str) -> bool:
        haystack = [
            project.name.lower(),
            project.path.lower(),
            project.space.lower(),
            ",".join(project.tags).lower(),
        ]
        return any(query in item for item in haystack)

    def _next_project_id(self, projects: list[Any]) -> int:
        max_id = 0
        for item in projects:
            if not isinstance(item, dict):
                continue
            project_id = self._project_id(item)
            if project_id > max_id:
                max_id = project_id
        return max_id + 1 if max_id >= 1 else 1

    def _project_id(self, data: dict[str, Any]) -> int:
        try:
            return int(data.get("id", 0))
        except (TypeError, ValueError):
            return 0

    def _find_project(self, projects: list[Any], project_id: int) -> dict[str, Any] | None:
        for item in projects:
            if not isinstance(item, dict):
                continue
            if self._project_id(item) == project_id:
                return item
        return None
