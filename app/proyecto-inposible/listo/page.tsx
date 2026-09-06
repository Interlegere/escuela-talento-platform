import type { Metadata } from "next"
import { existsSync } from "node:fs"
import path from "node:path"
import Image from "next/image"
import { crearLinkWhatsapp } from "@/lib/proyecto-inposible"
import PieDePagina from "@/components/proyecto-inposible/PieDePagina"
import { FUENTES_CLASSNAME } from "@/app/proyecto-inposible/fonts"
import { PALETA_PROYECTO_INPOSIBLE } from "@/app/proyecto-inposible/tokens"

// Pantalla de "vuelta" desde Mercado Pago (back_url de éxito/pendiente) —
// nunca se indexa. A diferencia de /gracias, no depende de sessionStorage:
// quien llega acá viene de un sitio externo y puede no tener nada guardado,
// así que todo sale de la URL (o de nada) en el propio servidor.
export const metadata: Metadata = {
  title: "¡Listo! — Proyecto In+Posible",
  robots: { index: false, follow: false },
}

const LOGO_EXISTE = existsSync(path.join(process.cwd(), "public", "logo-entheos.png"))

const BOTON_DORADO =
  "inline-flex items-center justify-center rounded-full bg-[var(--dorado)] px-6 py-3 text-[16px] font-bold text-[var(--tinta)] shadow-[0_0_16px_rgba(249,195,62,0.35),0_0_32px_rgba(249,195,62,0.16)] transition hover:bg-[var(--dorado-hover)] hover:shadow-[0_0_22px_rgba(249,195,62,0.49),0_0_45px_rgba(249,195,62,0.22)]"

const TARJETA = "rounded-3xl border border-[var(--tinta)]/15 bg-[var(--nube)] p-5 shadow-[0_18px_40px_rgba(36,31,28,0.06)]"

export default async function ListoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const leer = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""
  // Mercado Pago manda el estado como "status" o "collection_status" según
  // el flujo — se leen los dos. Cualquier valor que no sea "pending"/
  // "in_process" (incluido ningún parámetro, o uno inesperado) cae en el
  // caso normal — nunca se rompe la página por un parámetro raro.
  const statusCrudo = (leer(params.status) || leer(params.collection_status)).toLowerCase()
  const enProceso = statusCrudo === "pending" || statusCrudo === "in_process"

  // Esta página no prueba nada — cualquiera con el link puede abrirla sin
  // haber pagado. Nunca afirma que el pago está acreditado; la confirmación
  // de verdad la da Nicolás al ver la plata (mail + WhatsApp).
  const linkEscribir = crearLinkWhatsapp(
    "Hola Nicolás, ya reservé mi lugar en Proyecto In+Posible. Te cuento qué tengo en la cabeza:"
  )

  return (
    <div
      className={`${FUENTES_CLASSNAME} min-h-screen [font-family:var(--font-cuerpo)] bg-[var(--crema)] text-[var(--tinta)]`}
      style={PALETA_PROYECTO_INPOSIBLE}
    >
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {LOGO_EXISTE && (
          <Image
            src="/logo-entheos.png"
            alt="ENTHEOS"
            width={291}
            height={236}
            className="mx-auto mb-6 h-12 w-auto object-contain"
          />
        )}

        {enProceso && (
          <div className="mb-6 rounded-2xl border border-[var(--dorado)]/40 bg-[var(--arena)] p-4 text-center text-sm">
            Algunos medios de pago tardan unas horas en acreditarse. Apenas entre, te escribo.
          </div>
        )}

        <p className="text-center text-xs font-semibold uppercase tracking-[0.35em] opacity-70">Proyecto In+Posible</p>
        <h1 className="[font-family:var(--font-titulo)] mt-2 text-center text-4xl font-extrabold sm:text-5xl">¡Listo!</h1>
        <p className="mt-2 text-center text-lg font-semibold opacity-90 sm:text-xl">
          {enProceso ? "Tu pago está en proceso." : "Tu lugar en Proyecto In+Posible está reservado."}
        </p>

        <p className="mt-8 text-center text-lg">
          <strong>No esperás al 14 para empezar.</strong> Esto es lo que sigue:
        </p>

        <div className={`mt-6 space-y-5 ${TARJETA}`}>
          <div>
            <p className="font-bold">1 · Un mail, en las próximas horas.</p>
            <p className="mt-1 text-sm opacity-70">Con los primeros pasos y el acceso a tu espacio propio.</p>
          </div>
          <div>
            <p className="font-bold">2 · Un mensaje mío por WhatsApp.</p>
            <p className="mt-1 text-sm opacity-70">Para conocernos y para que me cuentes en qué andás.</p>
          </div>
          <div>
            <p className="font-bold">3 · El lunes 14 de septiembre a las 19 hs, el primer taller creativo: Las coordenadas.</p>
          </div>
        </div>

        <hr className="my-10 border-[var(--tinta)]/10" />

        <h2 className="[font-family:var(--font-titulo)] text-center text-2xl font-bold">Mientras tanto, hacé una sola cosa</h2>
        <p className="mx-auto mt-4 max-w-lg text-center opacity-80">
          Escribime y contame en una línea qué proyecto tenés en la cabeza. Aunque todavía no tenga forma. Aunque
          sea una inquietud.
        </p>
        <p className="mt-2 text-center opacity-80">Ese es, literalmente, el primer paso del programa.</p>

        {linkEscribir && (
          <div className="mt-7 flex justify-center">
            <a href={linkEscribir} target="_blank" rel="noopener noreferrer" className={BOTON_DORADO}>
              Escribirle a Nicolás
            </a>
          </div>
        )}

        <p className="mt-10 text-center text-xs opacity-60">
          Si pagaste por transferencia, mandame el comprobante por acá y te confirmo el lugar en el día.
        </p>
      </main>
      <PieDePagina />
    </div>
  )
}
