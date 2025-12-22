from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

DEFAULT_SPACE = "个人"


@dataclass(frozen=True)
class Project:
    id: int
    name: str
    path: str
    space: str
    tags: list[str]
    created_at: str
    updated_at: str
    last_opened_at: str | None


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_tags(tags: Iterable[str]) -> list[str]:
    normalized: list[str] = []
    for tag in tags:
        item = str(tag).strip()
        if item and item not in normalized:
            normalized.append(item)
    return normalized


def normalize_space(space: str) -> str:
    candidate = space.strip()
    return candidate or DEFAULT_SPACE
