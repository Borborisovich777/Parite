import { Currency, Member, Trip } from '../types';
import { requireSupabase } from './supabase';

export interface PhaseOneWorkspace {
  trip: Trip;
  currentMember: Member;
  members: Member[];
}

type Row = Record<string, any>;

function mapTrip(row: Row): Trip {
  return {
    id: row.id,
    name: row.name,
    base_currency: row.base_currency,
    invite_code: row.invite_code,
    created_at: row.created_at,
  };
}

function mapMember(row: Row): Member {
  return {
    id: row.id,
    trip_id: row.trip_id,
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    access_token: row.access_token,
    created_at: row.created_at,
    approved_at: row.approved_at ?? undefined,
    removed_at: row.removed_at ?? undefined,
  };
}

function unwrapJsonObject(data: unknown, rpcName: string): Row {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${rpcName} did not return an object.`);
  }

  return data as Row;
}

export async function createTripWithAdmin(
  name: string,
  baseCurrency: Currency,
  displayName: string
): Promise<{ trip: Trip; member: Member }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_trip_with_admin', {
    trip_name: name,
    base_currency: baseCurrency,
    display_name: displayName,
  });

  if (error) throw error;

  const row = unwrapJsonObject(data, 'create_trip_with_admin');
  return {
    trip: mapTrip(row.trip),
    member: mapMember(row.member),
  };
}

export async function requestJoinByInvite(
  inviteCode: string,
  displayName: string
): Promise<{ trip: Trip; member: Member }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('request_join_by_invite', {
    invite_code_input: inviteCode,
    display_name: displayName,
  });

  if (error) throw error;

  const row = unwrapJsonObject(data, 'request_join_by_invite');
  return {
    trip: mapTrip(row.trip),
    member: mapMember(row.member),
  };
}

export async function loadMemberSession(accessToken: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_member_session', {
    access_token_input: accessToken,
  });

  if (error) throw error;

  const row = unwrapJsonObject(data, 'load_member_session');
  return {
    trip: mapTrip(row.trip),
    currentMember: mapMember(row.member),
    members: Array.isArray(row.members) ? row.members.map(mapMember) : [],
  };
}

export async function approveMember(adminAccessToken: string, memberId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('approve_member', {
    admin_access_token_input: adminAccessToken,
    member_id_input: memberId,
  });

  if (error) throw error;
}

export async function rejectMember(adminAccessToken: string, memberId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('reject_member', {
    admin_access_token_input: adminAccessToken,
    member_id_input: memberId,
  });

  if (error) throw error;
}

export async function removeMember(adminAccessToken: string, memberId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('remove_member', {
    admin_access_token_input: adminAccessToken,
    member_id_input: memberId,
  });

  if (error) throw error;
}
