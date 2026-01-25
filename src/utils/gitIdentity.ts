import type { GitIdentity } from "../models/types";

export function normalizeGitIdentity(identity: GitIdentity): GitIdentity {
  return {
    name: identity.name.trim(),
    email: identity.email.trim(),
  };
}

export function normalizeGitIdentities(identities: GitIdentity[]): GitIdentity[] {
  return identities.map(normalizeGitIdentity);
}

export function buildGitIdentitySignature(identities: GitIdentity[]): string {
  const tokens = normalizeGitIdentities(identities)
    .map((identity) => `${identity.name.toLowerCase()}|${identity.email.toLowerCase()}`)
    .filter((value) => value !== "|")
    .sort();
  return tokens.join(";");
}
