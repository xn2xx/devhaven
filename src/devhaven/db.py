from devhaven.domain import Project
from devhaven.infrastructure.project_repository import ProjectRepository

Database = ProjectRepository

__all__ = ["Database", "Project"]
