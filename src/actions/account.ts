"use server";

import { redirect } from "next/navigation";
import { isAccountDeletionConfirmation } from "@/lib/account/data";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function deleteAccount(formData: FormData) {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login?next=/account");
  if (
    !isAccountDeletionConfirmation(formData.get("confirmation"), user.email)
  ) {
    redirect("/account?error=delete_confirmation");
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.auth.admin.deleteUser(user.id, false);
  if (error) {
    console.error("[account] deletion failed:", error.code ?? "delete_failed");
    redirect("/account?error=delete_failed");
  }

  // Auth deletion invalidates future getUser() checks. Also clear the local
  // cookies immediately so this browser does not retain an unusable JWT.
  await sb.auth.signOut({ scope: "local" });
  redirect("/login?account_deleted=1");
}
