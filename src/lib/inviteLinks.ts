const INVITE_QUERY_PARAM = 'invite';

export function normalizeInviteCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().slice(0, 32);
}

export function readInviteCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const inviteCode = normalizeInviteCode(params.get(INVITE_QUERY_PARAM));
  return inviteCode || null;
}

export function buildInviteUrl(inviteCode: string, currentHref: string): string {
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) {
    throw new Error('An invite code is required to build an invite link.');
  }

  const url = new URL(currentHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set(INVITE_QUERY_PARAM, normalizedCode);
  return url.toString();
}

export function removeInviteFromUrl(currentHref: string): string {
  const url = new URL(currentHref);
  url.searchParams.delete(INVITE_QUERY_PARAM);
  return url.toString();
}
