import Link from "next/link"

export default function LandingPage() {
  return (
    <main className="px-6 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-16rem)] max-w-5xl items-center">
        <section className="w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(253,247,236,0.82)] px-8 py-12 shadow-[0_24px_60px_rgba(55,42,28,0.08)] backdrop-blur-xl sm:px-12">
          <p className="workspace-eyebrow">Entheos</p>
          <h1 className="font-display mt-4 text-5xl leading-[0.95] tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">
            P&aacute;gina en construcci&oacute;n
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            Estamos preparando la presentaci&oacute;n institucional de Entheos.
            Mientras tanto, el acceso principal a la plataforma ya est&aacute;
            disponible.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/campus"
              className="inline-flex items-center justify-center rounded-full border border-[rgba(205,147,58,0.34)] bg-[rgba(255,250,242,0.85)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sea)] transition hover:-translate-y-0.5 hover:bg-[rgba(255,247,235,0.96)]"
            >
              Ir a Campus
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-[rgba(102,86,62,0.16)] bg-white/60 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--foreground)] transition hover:-translate-y-0.5 hover:bg-white/80"
            >
              Ingresar
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
