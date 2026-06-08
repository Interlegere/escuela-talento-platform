import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

const pilares = [
  {
    titulo: "Continuidad real",
    texto: "Acompañar también cuando aparece resistencia.",
  },
  {
    titulo: "Talento en acción",
    texto: "Convertir potencia en producción concreta.",
  },
  {
    titulo: "Éxito personal",
    texto: "Madurar una versión más lúcida y propia.",
  },
  {
    titulo: "Orden de los sentidos",
    texto: "Encontrar dirección sin perder sensibilidad.",
  },
  {
    titulo: "Comunidad y red",
    texto: "Crecer con otros, sin diluir la singularidad.",
  },
]

const ejes = [
  {
    titulo: "Talento",
    imagen: "/landing/talento.jpg",
    texto:
      "Descubrir, entrenar y conducir una capacidad hasta volverla producción propia.",
  },
  {
    titulo: "Entusiasmo",
    imagen: "/landing/entusiasmo.jpg",
    texto:
      "Una fuerza vital que necesita forma, dirección y continuidad para sostenerse.",
  },
  {
    titulo: "Orden de los sentidos",
    imagen: "/landing/orden-sentidos.jpg",
    texto:
      "Ordenar significado, dirección y sentimiento para decidir con presencia.",
  },
]

const transformaciones = [
  {
    titulo: "Emprendimientos nacidos desde cero",
    imagen: "/landing/transformacion-emprendimiento.jpg",
  },
  {
    titulo: "Duelos atravesados con dirección",
    imagen: "/landing/transformacion-duelo.jpg",
  },
  {
    titulo: "Profesionales que salieron del automático",
    imagen: "/landing/transformacion-proyecto.jpg",
  },
  {
    titulo: "Líderes reconectados",
    imagen: "/landing/transformacion-liderazgo.jpg",
  },
  {
    titulo: "Talentos convertidos en proyecto",
    imagen: "/landing/transformacion-proyecto.jpg",
  },
  {
    titulo: "Rumbos más propios",
    imagen: "/landing/transformacion-liderazgo.jpg",
  },
]

const actividades = [
  {
    titulo: "Conectando Sentidos",
    imagen: "/landing/actividad-conectando-sentidos.jpg",
    texto:
      "Encuentros grupales para ordenar experiencias, resignificar y volver al centro.",
    grande: true,
  },
  {
    titulo: "CasaTalentos",
    imagen: "/landing/actividad-casatalentos.jpg",
    texto:
      "Un espacio de continuidad para transformar talento en producción visible.",
    grande: true,
  },
  {
    titulo: "Mentorías",
    imagen: "/landing/actividad-mentorias.jpg",
    texto: "Encuentros individuales para ordenar dirección y próximos pasos.",
  },
  {
    titulo: "Arquitectos del Rumbo",
    imagen: "/landing/actividad-rumbo.jpg",
    texto: "Diseño de dirección personal, profesional o creativa.",
  },
  {
    titulo: "Terapia",
    imagen: "/landing/actividad-terapia.jpg",
    texto: "Acompañamiento clínico para crisis, bloqueo y maduración subjetiva.",
  },
]

function ImageSurface({
  imagen,
  className = "",
  children,
}: {
  imagen: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={`landing-photo-surface ${className}`}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(255, 249, 236, 0.1), rgba(133, 87, 30, 0.26)), url("${imagen}")`,
      }}
    >
      {children}
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="landing-public">
      <section id="inicio" className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy landing-rise">
            <p className="landing-eyebrow-light">Escuela Entheos</p>
            <h1 className="landing-hero-title">
              Desarrollá tu talento.
              <span>Entusiasmá tu vida.</span>
              <span>Producí tu mejor versión.</span>
            </h1>
            <p className="landing-hero-text">
              Una Escuela Nodo para ordenar sentidos, conducir talento y convertir lo que te mueve en dirección, producción y transformación real.
            </p>
            <div className="landing-hero-actions">
              <Link href="#escuela" className="landing-button-primary">
                Conocer la Escuela
              </Link>
              <Link href="/login" className="landing-button-secondary-light">
                Ingresar a la plataforma
              </Link>
            </div>
            <div className="landing-hero-indicators">
              <span>Talento</span>
              <span>Entusiasmo</span>
              <span>Producción</span>
              <span>Mejor Versión</span>
            </div>
          </div>

          <div className="landing-hero-visual landing-rise">
            <ImageSurface imagen="/landing/hero-persona.jpg" className="landing-hero-photo">
              {/* Reemplazar public/landing/hero-persona.jpg por foto real. */}
              <div className="landing-symbol-mark">
                <Image
                  src="/interlegere-icono.png"
                  alt="Entheos"
                  width={92}
                  height={92}
                  className="h-20 w-20 object-contain"
                  priority
                />
              </div>
              <div className="landing-floating-note">
                <span>Escuela viva</span>
                <p>Continuidad, dirección y producción propia.</p>
              </div>
            </ImageSurface>
          </div>
        </div>
      </section>

      <section className="landing-pillar-band">
        <div className="landing-pillar-grid">
          {pilares.map((pilar) => (
            <article key={pilar.titulo} className="landing-pillar">
              <span />
              <h3>{pilar.titulo}</h3>
              <p>{pilar.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="escuela" className="landing-editorial-section">
        <div className="landing-section-copy">
          <p className="landing-eyebrow-light">La Escuela</p>
          <h2>No sólo claridad. También continuidad.</h2>
          <p>
            Entheos no funciona como un curso ni como una promesa rápida. Acompaña procesos reales: cuando hay deseo y también cuando aparecen bloqueo, dispersión, crisis, duelo o pérdida de dirección.
          </p>
          <p>
            El centro no es motivarse un día. Es aprender a sostener una forma más madura, lúcida y productiva de vivir.
          </p>
        </div>
        <ImageSurface imagen="/landing/transformacion-liderazgo.jpg" className="landing-school-photo">
          {/* Reemplazar public/landing/transformacion-liderazgo.jpg por imagen real de comunidad/personas. */}
        </ImageSurface>
      </section>

      <section id="ejes" className="landing-light-section">
        <div className="landing-section-heading">
          <p className="landing-eyebrow-light">Tres ejes, un camino</p>
          <h2>Talento. Entusiasmo. Orden.</h2>
          <p>
            Tres fuerzas para pasar de intuición a dirección, de energía a continuidad y de sensibilidad a producción.
          </p>
        </div>
        <div className="landing-axis-grid">
          {ejes.map((eje) => (
            <article key={eje.titulo} className="landing-axis-card">
              <ImageSurface imagen={eje.imagen} className="landing-axis-image">
                {/* Reemplazar la imagen correspondiente en public/landing. */}
              </ImageSurface>
              <div>
                <span className="landing-small-mark" />
                <h3>{eje.titulo}</h3>
                <p>{eje.texto}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="transformaciones" className="landing-deep-section">
        <div className="landing-section-heading landing-section-heading-on-dark">
          <p className="landing-eyebrow-gold">Producciones y transformaciones</p>
          <h2>Cuando el proceso se vuelve visible</h2>
          <p>
            No mostramos promesas rápidas. Mostramos transformaciones que toman cuerpo en decisiones, proyectos, marcas, vínculos y formas de vivir.
          </p>
        </div>
        <div className="landing-story-grid">
          {transformaciones.map((item) => (
            <article
              key={item.titulo}
              className="landing-story-card"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(10, 55, 56, 0.05), rgba(9, 52, 54, 0.74)), url("${item.imagen}")`,
              }}
            >
              {/* Reemplazar la imagen correspondiente en public/landing. */}
              <h3>{item.titulo}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="actividades" className="landing-light-section">
        <div className="landing-section-heading">
          <p className="landing-eyebrow-light">Espacios de trabajo</p>
          <h2>Actividades que potencian tu camino</h2>
          <p>
            Cada entrada tiene una forma distinta: grupo, continuidad semanal, mentoría, rumbo o trabajo clínico.
          </p>
        </div>
        <div className="landing-activity-grid">
          {actividades.map((actividad) => (
            <article
              key={actividad.titulo}
              className={actividad.grande ? "landing-activity-card landing-activity-card-large" : "landing-activity-card"}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(255, 249, 236, 0.04), rgba(19, 80, 80, 0.5)), url("${actividad.imagen}")`,
              }}
            >
              {/* Reemplazar la imagen correspondiente en public/landing. */}
              <div>
                <h3>{actividad.titulo}</h3>
                <p>{actividad.texto}</p>
                <Link href="#contacto">Conocer más</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="recursos" className="landing-resource">
        <div className="landing-resource-copy">
          <p className="landing-eyebrow-light">Recurso gratuito</p>
          <h2>Recibí una guía para leer tu momento actual</h2>
          <p>
            Una entrada breve para observar qué pide orden, dirección o continuidad en este momento de tu vida.
          </p>
          <form className="landing-resource-form">
            <input placeholder="Nombre" />
            <input type="email" placeholder="Email" />
            <button type="button">Recibir recurso</button>
          </form>
        </div>
        <ImageSurface imagen="/landing/recurso-guia.jpg" className="landing-guide-cover">
          {/* Reemplazar public/landing/recurso-guia.jpg por mockup real. */}
          <span>Guía práctica</span>
          <strong>Leer tu momento actual</strong>
        </ImageSurface>
      </section>

      <section id="director" className="landing-director-section">
        <ImageSurface imagen="/landing/director-nicolas.jpg" className="landing-director-photo">
          {/* Reemplazar public/landing/director-nicolas.jpg por foto real. */}
        </ImageSurface>
        <div className="landing-director-copy">
          <p className="landing-eyebrow-light">Dirección</p>
          <h2>Nicolás Busico</h2>
          <p>
            Licenciado en Psicología y director de Entheos Escuela. Trabaja en el cruce entre desarrollo humano, talento, entusiasmo, producción original y transformación personal.
          </p>
          <blockquote>
            “La pregunta no es sólo qué entendés de vos. La pregunta es qué podés producir con eso.”
          </blockquote>
        </div>
      </section>

      <section id="contacto" className="landing-contact-section">
        <div className="landing-section-heading">
          <p className="landing-eyebrow-light">Contacto</p>
          <h2>Consultar por una actividad</h2>
          <p>
            La conversación inicial también forma parte de leer cuál es la puerta adecuada para este momento.
          </p>
        </div>
        <form className="landing-contact-form">
          <input className="landing-input" placeholder="Nombre" />
          <input className="landing-input" type="email" placeholder="Email" />
          <input className="landing-input" placeholder="Motivo de consulta" />
          <textarea className="landing-input min-h-36" placeholder="Mensaje" />
          <button type="button" className="landing-button-primary">
            Enviar consulta
          </button>
        </form>
        <div className="landing-social-row">
          <a href="https://wa.me/">WhatsApp</a>
          <a href="https://www.instagram.com/">Instagram</a>
          <a href="https://www.linkedin.com/">LinkedIn</a>
        </div>
      </section>
    </main>
  )
}
