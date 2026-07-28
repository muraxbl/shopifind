'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeProfileInput } from '@/lib/profile/input';

export async function updateProfile(formData: FormData) {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect('/login?next=/account');

  const parsed = normalizeProfileInput({
    fullName: formData.get('full_name'),
    nichePrefs: formData.getAll('niche_prefs'),
  });
  if (!parsed.success) {
    redirect(`/account?error=${parsed.error}`);
  }

  const { data, error } = await sb
    .from('users')
    .update({
      full_name: parsed.data.fullName,
      niche_prefs: parsed.data.nichePrefs,
    } as never)
    .eq('id', user.id)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.error('[profile] update failed:', error?.message ?? 'profile_missing');
    redirect('/account?error=save_failed');
  }

  revalidatePath('/account');
  redirect('/account?saved=1');
}

export async function signOut() {
  const sb = await createServerSupabaseClient();
  await sb.auth.signOut({ scope: 'local' });
  redirect('/login?signed_out=1');
}
