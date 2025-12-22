from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

CONFIG_DIR_NAME = ".devhaven"
CONFIG_FILE_NAME = "config.json"
DEFAULT_CONFIG: dict[str, Any] = {
    "open_command": "",
    "projects": [],
    "next_project_id": 1,
}


def data_dir() -> Path:
    return Path.home() / CONFIG_DIR_NAME


def config_path() -> Path:
    return data_dir() / CONFIG_FILE_NAME


def load_config() -> dict[str, Any]:
    path = config_path()
    if not path.exists():
        return deepcopy(DEFAULT_CONFIG)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return deepcopy(DEFAULT_CONFIG)
    base = deepcopy(DEFAULT_CONFIG)
    if isinstance(payload, dict):
        base.update(payload)
    return base


def save_config(config: dict[str, Any]) -> None:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
