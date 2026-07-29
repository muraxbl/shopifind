const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Introduce una dirección de email válida.",
  invalid_form: "No hemos podido procesar el formulario. Inténtalo de nuevo.",
  invalid_provider: "Ese método de acceso no está disponible.",
  magic_link_invalid:
    "El enlace no es válido o ya se ha utilizado. Solicita uno nuevo.",
  magic_link_send_failed:
    "No hemos podido enviar el enlace. Espera un momento e inténtalo de nuevo.",
  oauth_callback_failed:
    "No hemos podido completar el acceso. Inténtalo de nuevo.",
  oauth_exception: "No hemos podido iniciar ese método de acceso.",
  oauth_init_failed: "No hemos podido iniciar ese método de acceso.",
};

export function authErrorMessage(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return (
    AUTH_ERROR_MESSAGES[code] ??
    "No hemos podido completar el acceso. Inténtalo de nuevo."
  );
}
