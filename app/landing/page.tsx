import Link from "next/link"

export default function LandingPage() {
  return (
    <main className="px-6 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-16rem)] max-w-5xl items-center">
        <section className="w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(253,247,236,0.82)] px-8 py-12 shadow-[0_24px_60px_rgba(55,42,28,0.08)] backdrop-blur-xl sm:px-12">
          <p className="workspace-eyebrow">Entheos</p>
          <h1 className="font-display mt-4 text-5xl leading-[0.95] tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">
            Página en construcción
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            Estamos preparando la presentación institucional de Entheos.
            Mientras tanto, el acceso principal a la plataforma ya está
            disponible.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/campus" className="workspace-button-primary">
              Ir a Campus
            </Link>
            <Link href="/login" className="workspace-button-secondary">
              Ingresar
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
