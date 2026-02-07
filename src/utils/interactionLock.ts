let locked = false;

export function setInteractionLocked(next: boolean) {
  locked = next;
}

export function isInteractionLocked(): boolean {
  return locked;
}

