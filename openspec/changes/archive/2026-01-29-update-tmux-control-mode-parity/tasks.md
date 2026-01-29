## 1. Implementation
- [x] 1.1 Add control-mode state machine and response block tracking
- [x] 1.2 Implement command queue with control-channel send and timeout handling
- [x] 1.3 Expand control-line parsing and event emission
- [x] 1.4 Route core tmux operations through control channel with CLI fallback
- [x] 1.5 Add recovery mode for reconnects and partial line handling
- [x] 1.6 Parse full control-mode notification set and emit structured events
- [x] 1.7 Capture response block output and return it with command completion

## 2. Verification
- [x] 2.1 Add/adjust unit tests for control line parsing and decoding
- [ ] 2.2 Validate tmux workflow in a local session (manual smoke test)
- [x] 2.3 Add tests covering newly supported notifications
