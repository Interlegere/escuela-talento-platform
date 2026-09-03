import { ImageResponse } from "next/og"

export const alt = "Proyecto In+Posible — ENTHEOS"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 90px",
          background: "linear-gradient(135deg, #f4ecde 0%, #fdf6e8 45%, #ecd9ae 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#9a6218",
            marginBottom: 28,
          }}
        >
          ENTHEOS
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#3a3226",
            marginBottom: 6,
          }}
        >
          Proyecto
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 118,
            fontWeight: 800,
            lineHeight: 1,
            color: "#202529",
          }}
        >
          In
          <span style={{ color: "#cf9130" }}>+</span>
          Posible
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 500,
            color: "#5a4a2e",
            marginTop: 34,
          }}
        >
          Plasmá en tres meses eso que venís postergando.
        </div>
      </div>
    ),
    { ...size }
  )
}
