export default function PrivacyPage() {
  return (
    <div className="container py-16">
      <h1 className="font-display text-4xl">Política de privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: hoy</p>

      <div className="prose prose-stone mt-8 max-w-3xl">
        <h2>Datos que recolectamos</h2>
        <ul>
          <li>Email y perfil básico (si creas cuenta o wishlist).</li>
          <li>Preferencias de nicho y alertas configuradas.</li>
          <li>Analytics de uso agregados y anónimos (Plausible — sin cookies).</li>
        </ul>
        <h2>Qué NO recolectamos</h2>
        <ul>
          <li>No vendemos datos personales a terceros.</li>
          <li>No usamos trackers cross-site publicitarios.</li>
          <li>No construimos perfiles publicitarios.</li>
        </ul>
        <h2>Tus derechos (UE / UK)</h2>
        <p>
          Acceso, rectificación, supresión, oposición, portabilidad. Para ejercerlos escribe a&nbsp;
          <a href="mailto:privacy@shopifind.com">privacy@shopifind.com</a>.
        </p>
        <h2>Hosting y transferencias internacionales</h2>
        <p>
          Base de datos en Supabase (Frankfurt o Virginia). Transferencias a EE.UU. cubiertas por
          EU-US Data Privacy Framework o cláusulas contractuales tipo de la Comisión Europea.
        </p>
      </div>
    </div>
  );
}
