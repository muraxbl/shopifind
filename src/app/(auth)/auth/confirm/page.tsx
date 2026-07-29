import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isValidEmailTokenHash } from "@/lib/auth/magic-link";

export const metadata: Metadata = {
  title: "Confirma tu acceso",
  robots: { index: false, follow: false },
};

export default async function ConfirmMagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    redirect_to?: string;
  }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash?.trim() ?? "";
  const redirectTo = params.redirect_to?.slice(0, 2048) ?? "";
  const valid = params.type === "email" && isValidEmailTokenHash(tokenHash);

  return (
    <div className="container flex min-h-[75vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-sm sm:p-9">
        <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        <h1 className="mt-5 font-display text-3xl">Confirma tu acceso</h1>

        {valid ? (
          <>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pulsa el botón para iniciar sesión en este dispositivo. El enlace
              es de un solo uso.
            </p>
            <form action="/api/auth/confirm" method="POST" className="mt-7">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="email" />
              <input type="hidden" name="redirect_to" value={redirectTo} />
              <Button type="submit" className="w-full gap-2">
                Continuar e iniciar sesión
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              El enlace está incompleto o no es válido. Solicita uno nuevo para
              acceder de forma segura.
            </p>
            <Button asChild className="mt-7 w-full">
              <Link href="/login">Solicitar otro enlace</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
