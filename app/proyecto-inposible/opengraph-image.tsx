import { ImageResponse } from "next/og"
import { readFileSync } from "node:fs"
import path from "node:path"

export const runtime = "nodejs"

export const alt = "Proyecto In+Posible — ENTHEOS"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const TINTA = "#241F1C"
const DORADO = "#F9C33E"
const CREMA = "#FFFCF7"

// Satori (lo que arma la imagen) no toma fuentes por CSS: hay que pasarle
// los bytes de la tipografía. Se piden a Google Fonts en cada request (con
// un User-Agent viejo, para que devuelva .ttf en vez de .woff2, que Satori
// no soporta) — mismo patrón que usa la documentación oficial de next/og.
async function obtenerFuente(familia: string, peso: number): Promise<ArrayBuffer> {
  // La API de Google Fonts espera los espacios del nombre de familia como
  // "+" literal en el query string, no percent-encoded — encodeURIComponent
  // rompe esto (convierte el "+" en %2B), así que se arma el query a mano.
  const familiaQuery = familia.trim().replace(/\s+/g, "+")
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${familiaQuery}:wght@${peso}&display=swap`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.34 (KHTML, like Gecko) PhantomJS/1.9.7 Safari/534.34" } }
  ).then((r) => r.text())
  const url = css.match(/src: url\(([^)]+)\)/)?.[1]
  if (!url) throw new Error(`No se encontró la fuente ${familia} ${peso}`)
  return fetch(url).then((r) => r.arrayBuffer())
}

function leerComoDataUri(archivo: string, tipo: string) {
  const buffer = readFileSync(path.join(process.cwd(), "public", archivo))
  return `data:${tipo};base64,${buffer.toString("base64")}`
}

export default async function Image() {
  const [loraRegular, loraBold, instrumentBold] = await Promise.all([
    obtenerFuente("Lora", 400),
    obtenerFuente("Lora", 700),
    obtenerFuente("Instrument Sans", 700),
  ])

  const logo = leerComoDataUri("logo-entheos.png", "image/png")
  const foto = leerComoDataUri("proyecto-inposible-og-nicolas.jpg", "image/jpeg")

  // Bloque de foto: x 740→1200 (460 de ancho), y 0 hasta el borde de la
  // franja (630 - 96 = 534). La foto ya viene pre-recortada y encuadrada
  // en la cara (public/proyecto-inposible-og-nicolas.jpg, generada a
  // partir de nicolas-sunset.jpg) — acá solo hace falta cubrir el rectángulo.
  const FOTO_X = 740
  const FOTO_ANCHO = 460
  const FOTO_ALTO = 534

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: TINTA }}>
        {/* Resplandor dorado suave, arriba a la izquierda */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage: `radial-gradient(900px 620px at 12% -8%, rgba(249,195,62,0.22), rgba(249,195,62,0) 70%)`,
          }}
        />

        {/* Foto de Nicolás, ya recortada y encuadrada en la cara */}
        <img
          src={foto}
          alt=""
          width={FOTO_ANCHO}
          height={FOTO_ALTO}
          style={{ position: "absolute", left: FOTO_X, top: 0, width: FOTO_ANCHO, height: FOTO_ALTO, objectFit: "cover" }}
        />
        {/* Desvanecido hacia la izquierda contra el fondo — ImageResponse no
            soporta mask-image/filter, así que el degradado va en un div
            encima de la foto, mismo rectángulo. */}
        <div
          style={{
            position: "absolute",
            left: FOTO_X,
            top: 0,
            width: FOTO_ANCHO,
            height: FOTO_ALTO,
            display: "flex",
            backgroundImage: `linear-gradient(to right, ${TINTA} 0%, rgba(36,31,28,0.85) 35%, rgba(36,31,28,0) 100%)`,
          }}
        />

        {/* Logo + ENTHEOS */}
        <div style={{ position: "absolute", left: 72, top: 58, display: "flex", alignItems: "center", gap: 18 }}>
          {/* 291x236 real — Satori no resuelve bien width:"auto" en <img>,
              así que el ancho sale calculado a mano según el aspect ratio. */}
          <img src={logo} alt="" width={67} height={54} style={{ width: 67, height: 54 }} />
          <span
            style={{
              fontFamily: "Instrument Sans",
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: DORADO,
            }}
          >
            ENTHEOS
          </span>
        </div>

        {/* Proyecto In+Posible */}
        <div style={{ position: "absolute", left: 72, top: 200, display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "Lora", fontWeight: 400, fontSize: 60, lineHeight: 1, color: CREMA }}>
            Proyecto
          </span>
          <span style={{ fontFamily: "Lora", fontWeight: 700, fontSize: 96, lineHeight: 1.05, color: CREMA, display: "flex", marginTop: 6 }}>
            In<span style={{ color: DORADO }}>+</span>Posible
          </span>
        </div>

        {/* Franja inferior con la fecha */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 1200,
            height: 96,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: DORADO,
          }}
        >
          <span
            style={{
              fontFamily: "Instrument Sans",
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: TINTA,
            }}
          >
            EMPIEZA EL 14 · CIERRA EL 11 DE SEPTIEMBRE
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Lora", data: loraRegular, weight: 400, style: "normal" },
        { name: "Lora", data: loraBold, weight: 700, style: "normal" },
        { name: "Instrument Sans", data: instrumentBold, weight: 700, style: "normal" },
      ],
    }
  )
}
