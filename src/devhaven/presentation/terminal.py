from __future__ import annotations

import asyncio
import os
import pty
from pathlib import Path
import shlex

from textual import app as textual_app
from textual import events
from textual.theme import BUILTIN_THEMES

if not hasattr(textual_app, "DEFAULT_COLORS"):
    textual_app.DEFAULT_COLORS = {
        "dark": BUILTIN_THEMES["textual-dark"].to_color_system(),
        "light": BUILTIN_THEMES["textual-light"].to_color_system(),
    }

from textual_terminal import Terminal
from textual_terminal._terminal import TerminalEmulator as BaseTerminalEmulator


class ProjectTerminalEmulator(BaseTerminalEmulator):
    def open_terminal(self, command: str):
        self.pid, fd = pty.fork()
        if self.pid == 0:
            argv = shlex.split(command)
            env = os.environ.copy()
            env.setdefault("TERM", "xterm")
            env.setdefault("LC_ALL", "en_US.UTF-8")
            env.setdefault("HOME", str(Path.home()))
            os.execvpe(argv[0], argv, env)
        return fd


class ProjectTerminal(Terminal):
    def start(self) -> None:
        if self.emulator is not None:
            return
        self.emulator = ProjectTerminalEmulator(command=self.command)
        self.emulator.start()
        self.send_queue = self.emulator.recv_queue
        self.recv_queue = self.emulator.send_queue
        self.recv_task = asyncio.create_task(self.recv())

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
