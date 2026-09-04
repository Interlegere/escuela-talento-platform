import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import FormularioPreinscripcion from "@/components/proyecto-inposible/FormularioPreinscripcion"
import CarruselProyectos from "@/components/proyecto-inposible/CarruselProyectos"
import SeccionAnimada from "@/components/proyecto-inposible/SeccionAnimada"
import PullQuote from "@/components/proyecto-inposible/PullQuote"
import GrupoFilasAnimadas from "@/components/proyecto-inposible/GrupoFilasAnimadas"
import TarjetaColapsable from "@/components/proyecto-inposible/TarjetaColapsable"
import HeroInPosible from "@/components/proyecto-inposible/HeroInPosible"
import BandaNumeros from "@/components/proyecto-inposible/BandaNumeros"
import BarraFija from "@/components/proyecto-inposible/BarraFija"
import Acordeon from "@/components/proyecto-inposible/Acordeon"
import Testimonios from "@/components/proyecto-inposible/Testimonios"
import {
  IconoCalendario,
  IconoCelular,
  IconoDosPersonas,
  IconoWhatsapp,
  IconoGrupo,
  IconoBrujula,
  IconoChispa,
  IconoSemilla,
} from "@/components/proyecto-inposible/Iconos"
import { formatearMontoArs, PRECIOS_ARS, TALLERES } from "@/lib/proyecto-inposible"
import { ASSETS } from "@/lib/proyecto-inposible-assets"
import { FUENTES_CLASSNAME, FUENTE_CUERPO_VAR, FUENTE_TITULO_VAR } from "./fonts"
import { TOKEN_TEXTO, TOKEN_TEXTO_CHICO } from "./tokens"

const TITULO = "Proyecto In+Posible — ENTHEOS"
const DESCRIPCION = "Plasmá en tres meses eso que venís postergando toda tu vida."

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    type: "website",
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
  },
}

// Paleta nueva — tres intentos con la familia tierra (azul, marrón, ocre)
// fallaron. El contraste ahora lo dan las fotos y el naranja, no
// rectángulos de color: ninguna sección tiene fondo oscuro. #4A3227,
// #C49A6C, #E4783C, #C9512F y #F2E6CE quedan completamente retirados.
const PALETA = {
  "--tinta": "#241F1C",
  "--naranja": "#F2662A",
  "--coral": "#D8452B",
  "--sol": "#FFC24B",
  "--crema": "#FFFCF7",
  "--nube": "#FFFFFF",
  "--arena": "#FBEFDC",
  "--verde-brote": "#4E7C59",
  "--font-titulo": FUENTE_TITULO_VAR,
  "--font-cuerpo": FUENTE_CUERPO_VAR,
} as React.CSSProperties

// Escala tipográfica única para toda la página.
const TITULO_FONT = "[font-family:var(--font-titulo)]"
const H1 = `${TITULO_FONT} text-[clamp(40px,9vw,76px)] font-extrabold leading-[1.02] tracking-[-0.02em]`
const H2 = `${TITULO_FONT} text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.01em]`
const H3 = `${TITULO_FONT} text-[clamp(21px,3vw,26px)] font-bold`
// Único tamaño de cuerpo para las secciones (19px desktop / 18px mobile) y
// único ancho de lectura (680px) — las excepciones puntuales (frase de
// "Qué es", los destacados de los ejes, el nombre del hero, la pregunta del
// cierre, y los números del bloque de precio) se escriben con su propio
// tamaño, no con este token.
const TEXTO = TOKEN_TEXTO
const TEXTO_CHICO = TOKEN_TEXTO_CHICO

// Regla de contraste de toda la página — vale para los 9 botones
// "¡Quiero mi lugar!" (BotonCTA×6 acá, BarraFija×2, el submit del
// formulario), medida sobre los colores reales de la paleta:
//
//   fondo naranja          → texto tinta   (5,21:1) ✓
//   fondo tinta             → texto crema   (11,4:1) ✓
//   fondo crema/arena/nube → texto tinta            ✓
//   nunca: crema sobre naranja             (2,96:1) ✗
//
// "invertido" es la única excepción de fondo — para usar arriba de la
// propia banda naranja, donde un botón naranja se perdería contra su
// propio fondo — pero el texto sigue la misma regla (fondo crema → tinta).
function BotonCTA({
  variante = "naranja",
  className,
  style,
}: {
  variante?: "naranja" | "invertido"
  className?: string
  style?: React.CSSProperties
}) {
  const estilos = {
    // El "!" no es cosmético: app/globals.css tiene `a { color: inherit }`
    // sin @layer, y por reglas de cascade layers eso gana siempre sobre
    // cualquier utility de Tailwind (que sí van en layer), sin importar
    // especificidad — sin el important, cada <a> hereda el color de texto
    // de la sección que lo rodea en vez de usar el suyo propio (esto pasó
    // de verdad: el botón de la banda naranja quedaba crema sobre crema,
    // invisible, porque heredaba el texto de esa sección).
    naranja: "bg-[var(--naranja)] text-[var(--tinta)]! hover:bg-[var(--coral)]",
    invertido: "bg-[var(--crema)] text-[var(--tinta)]! hover:opacity-90",
  }[variante]
  return (
    <a
      href="#inscripcion"
      style={style}
      className={`inline-flex min-h-[52px] items-center justify-center rounded-full px-8 text-[19px] font-bold transition ${estilos} ${
        className ?? ""
      }`}
    >
      ¡Quiero mi lugar!
    </a>
  )
}

function IconoCirculo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--arena)] text-[var(--naranja)]">
      {children}
    </div>
  )
}

// Mismo esqueleto para "Los tres ejes" y "Cómo funciona" — columna angosta
// a la izquierda (ícono + rótulo), tarjeta colapsable a la derecha. Que las
// dos secciones compartan esta forma es lo que hace que la página se lea
// como un sistema.
function FilaComoFunciona({
  id,
  icono,
  rotulo,
  titulo,
  children,
  extra,
  className,
  style,
}: {
  id: string
  icono: React.ReactNode
  rotulo: string
  titulo: string
  children: React.ReactNode
  extra?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={`flex flex-col gap-5 sm:flex-row sm:gap-10 ${className ?? ""}`} style={style}>
      <div className="flex shrink-0 flex-row items-center gap-3 sm:w-48 sm:flex-col sm:items-start">
        <IconoCirculo>{icono}</IconoCirculo>
        <p className={`${TEXTO_CHICO} font-semibold uppercase tracking-[0.12em] opacity-60`}>{rotulo}</p>
      </div>
      <TarjetaColapsable id={id} titulo={titulo} extra={extra}>
        {children}
      </TarjetaColapsable>
    </div>
  )
}

function FilaEje({
  id,
  icono,
  numero,
  taller,
  titulo,
  children,
  className,
  style,
}: {
  id: string
  icono: React.ReactNode
  numero: string
  taller: string
  titulo: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={`flex flex-col gap-5 sm:flex-row sm:gap-10 ${className ?? ""}`} style={style}>
      <div className="shrink-0 sm:w-48">
        <IconoCirculo>{icono}</IconoCirculo>
        <span className={`${TITULO_FONT} mt-3 block text-6xl font-extrabold leading-none text-[var(--naranja)] sm:text-7xl`}>
          {numero}
        </span>
        <p className={`${TEXTO_CHICO} mt-2 font-semibold uppercase tracking-[0.12em] opacity-60`}>{taller}</p>
      </div>
      <TarjetaColapsable id={id} titulo={titulo}>
        {children}
      </TarjetaColapsable>
    </div>
  )
}

function MarcoTelefono({ src, alt }: { src: string; alt: string }) {
  // 135px en desktop es el máximo que entran los 3 en una sola fila dentro
  // del ancho real de la tarjeta.
  return (
    <div className="w-[90px] shrink-0 overflow-hidden rounded-[18px] border-[3px] border-[var(--tinta)] shadow-[0_12px_28px_rgba(36,31,28,0.18)] sm:w-[135px]">
      <Image src={src} alt={alt} width={280} height={606} className="h-auto w-full object-cover" />
    </div>
  )
}

const PREGUNTAS_FRECUENTES = [
  {
    pregunta: "¿Y si no tengo ningún proyecto todavía?",
    respuesta:
      "Es uno de los puntos de partida más comunes, y el programa está hecho también para eso: elegir sobre qué trabajar, o crear la idea desde cero. Si lo que tenés es una inquietud y la sensación de que hay algo para dar, alcanza para empezar.",
  },
  {
    pregunta: "¿Cuánto tiempo por semana me lleva?",
    respuesta:
      "Lo fijo son dos horas por mes: el taller en vivo. Lo demás es personalizado, porque los procesos de cada uno son recorridos que no se miden solo con el tiempo. Y sí: cuanto más tiempo le dediques, más avances y más ganancia vas a tener.",
  },
  {
    pregunta: "¿Sirve si mi proyecto no es un negocio?",
    respuesta:
      "Sí. Trabajamos con proyectos de deporte, arte, música, emprendimientos, empresas y oficios. Lo que se pone en marcha es tu talento; la forma que tome después la define cada quien.",
  },
  {
    pregunta: "¿Hay que saber algo de inteligencia artificial?",
    respuesta:
      "No. Vas a aprender a usarla como herramienta aun si nunca la usaste, y siempre a favor de tu proyecto: nunca le pedimos que piense ni que decida por nosotros.",
  },
  {
    pregunta: "¿Y si no puedo estar en vivo en algún taller?",
    respuesta:
      "Vas a tener la grabación disponible durante los 7 días siguientes, y el trabajo del mes lo seguís en tu espacio propio y por WhatsApp.",
  },
  {
    pregunta: "¿Cómo pago desde otro país?",
    respuesta: "Por transferencia internacional, en dólares o en euros. Los datos te llegan por mail al completar el formulario.",
  },
]

export default function ProyectoInPosiblePage() {
  return (
    <div className={`${FUENTES_CLASSNAME} [font-family:var(--font-cuerpo)]`} style={PALETA}>
      {/* Sin JS, la animación de entrada de SeccionAnimada nunca corre —
          esto fuerza que el contenido se vea igual, sin depender de que
          el IntersectionObserver o el timeout de respaldo lleguen a
          ejecutarse (ninguno de los dos existe sin JavaScript). */}
      <noscript>
        <style>{`.opacity-0{opacity:1!important}.translate-y-5{transform:none!important}`}</style>
      </noscript>
      <BarraFija />

      {/* 1 · Hero con el collage a sangre + 2 · tira de logos (dentro) */}
      <HeroInPosible
        eyebrow={<p className={`${TEXTO_CHICO} font-semibold uppercase tracking-[0.35em] opacity-70`}>ENTHEOS</p>}
        nombre={
          <h1 className={`${H1} mt-5`}>
            Proyecto In<span className="text-[var(--naranja)]">+</span>Posible
          </h1>
        }
        bajada={
          <p className="mx-auto mt-7 max-w-xl text-xl font-medium opacity-90 sm:text-2xl">
            Plasmá en tres meses eso que venís postergando toda tu vida.
          </p>
        }
        lineaInfo={
          // Este bloque cae más abajo en el hero, justo donde el velo es
          // más débil (45% en el medio del degradé) — le agrega un fondo
          // propio semi-opaco atrás, solo a él, en vez de tocar el velo
          // general de toda la foto.
          <div className="mt-4 inline-block rounded-2xl bg-[var(--tinta)]/40 px-4 py-2">
            <p className="text-[15px] font-medium opacity-95 sm:text-base">
              <span className="block">Programa de mentoría de tres meses</span>
              <span className="block">Arranca el lunes 14 de septiembre</span>
              <span className="block">Cupos dedicados</span>
            </p>
          </div>
        }
        boton={
          <div className="mt-9">
            <BotonCTA />
          </div>
        }
      />

      {/* 3 · Banda de números */}
      <SeccionAnimada fondo="arena">
        <BandaNumeros />
      </SeccionAnimada>

      {/* 4 · Qué es */}
      <SeccionAnimada fondo="crema" ancho="ancho">
        <div className="max-w-[680px] border-l-8 border-[var(--naranja)] pl-6 sm:pl-8">
          <p className="text-2xl font-medium leading-snug sm:text-3xl">
            <strong className="font-bold">Proyecto In+Posible</strong> es un programa de mentoría
            personalizada y grupal, para descubrir, encender y poner en marcha tu talento, trabajando
            sobre un proyecto concreto que parece imposible de lograr... ¡hasta ahora!
          </p>
        </div>
      </SeccionAnimada>

      {/* 5 · El problema → ¡se abre! */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <div className={`${TEXTO} space-y-6`}>
          <p>
            Lo pensaste muchas veces... lo anotaste en algún cuaderno... se lo contaste a alguien de
            confianza y te dijo &ldquo;¡qué buena idea!&rdquo;. Y ahí quedó.
          </p>
          <p>
            ¿Acaso se trata de las ganas? O... ¿tener un talento especial? Tal vez es que nunca supiste
            cuál es el primer paso... y sin ese primer paso, todo lo que viene después parece imposible.
          </p>
          <p>
            A veces ni siquiera hay un proyecto todavía. Hay una inquietud, la sensación de estar
            desperdiciando algo, la certeza de que tenés algo para dar y no sabés bien qué es. No lo des
            por perdido, estás ante una puerta de entrada que es la más difícil de abrir... pero...
          </p>
        </div>
        <p className={`${TITULO_FONT} mt-2 text-[44px] font-extrabold leading-[1.05] text-[var(--naranja)]`}>
          ¡se abre!
        </p>
      </SeccionAnimada>

      {/* 6 · Los tres ejes — colapsables */}
      <SeccionAnimada fondo="crema" ancho="ancho">
        <h2 className={H2}>Los tres ejes del programa</h2>
        <p className="mt-3 text-xl font-medium opacity-70 sm:text-2xl">
          Un eje por taller: lo que vamos a trabajar en septiembre, en octubre y en noviembre.
        </p>

        <div className="mt-8">
          <GrupoFilasAnimadas conLinea>
            <FilaEje
              id="eje-1"
              icono={<IconoBrujula className="h-5 w-5" />}
              numero="1"
              taller="TALLER 1 · LUNES 14 DE SEPTIEMBRE"
              titulo="Las coordenadas"
            >
              <p>
                Claves y coordenadas para empezar tu viaje con un GPS orientado hacia el crecimiento: a
                qué apuntar, por dónde ir, cuáles son los primeros resultados a lograr y... lo más
                importante: ¡quién lo está haciendo!
              </p>
              <p>Porque para dar el primer paso queremos sentirnos seguros.</p>
              <PullQuote>Y a la vez, es dar el primer paso lo que te vuelve seguro de verdad.</PullQuote>
            </FilaEje>

            <FilaEje
              id="eje-2"
              icono={<IconoChispa className="h-5 w-5" />}
              numero="2"
              taller="TALLER 2 · LUNES 12 DE OCTUBRE"
              titulo="Empezar sin esperar a estar listo"
            >
              <p>
                Es en el viaje, caminando, donde nos damos cuenta de qué tenemos que ajustar y actualizar
                en nuestros objetivos. Esperar a tenerlo todo claro y resuelto para dar el primer paso es
                el error más frecuente de los que nunca empiezan. Entonces entra una decisión muy
                importante: ¿voy a prepararme eternamente para nunca empezar? o...
              </p>
              <PullQuote>¡Avanzo para darme cuenta de qué rumbo estoy tomando!</PullQuote>
            </FilaEje>

            <FilaEje
              id="eje-3"
              icono={<IconoSemilla className="h-5 w-5" />}
              numero="3"
              taller="TALLER 3 · LUNES 9 DE NOVIEMBRE"
              titulo="Semilla y primeros brotes"
            >
              <p>
                Dicen que en el interior de la semilla se encuentra la energía y el potencial para dar
                lugar a toda una vida... que, con el deseo y la decisión de ir más allá, emerge de la
                tierra en sus primeros y más delicados brotes.
              </p>
              <p>
                <strong>
                  Un primer paso que, si lo descuidamos, lo olvidamos y lo abandonamos... no crece.
                </strong>
              </p>
              <p>
                Es aquí donde se juegan los recaudos más importantes y el éxito de tu proyecto:
                necesitamos proteger y darle mucho amor a lo que hacés nacer, para que... de aquí a un
                año... recuerdes este momento y valores:
              </p>
              <PullQuote>&ldquo;¡Qué lindo es dedicar mi tiempo a lo que amo hacer!&rdquo;</PullQuote>
            </FilaEje>
          </GrupoFilasAnimadas>
        </div>

        <div className="mt-8">
          <BotonCTA />
        </div>
      </SeccionAnimada>

      {/* 7 · Cómo funciona — colapsables, mismo esqueleto que los ejes */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <h2 className={H2}>Cómo funciona</h2>

        <div className="mt-8">
          <GrupoFilasAnimadas conLinea>
            <FilaComoFunciona id="cf-talleres" icono={<IconoCalendario className="h-5 w-5" />} rotulo="TALLERES" titulo="Un taller creativo por mes">
              <p>Tres encuentros en vivo, los lunes a las 19 hs:</p>
              <p className="font-semibold opacity-100">{TALLERES.map((t) => t.etiqueta).join(" · ")}</p>
              <p>Cada taller creativo de los lunes proporciona 2 hs. de expansión.</p>
              <p>
                En cada uno trabajamos un eje, con claves concretas y casos reales. Te llevás lo necesario
                para empezar a aplicar y recorrer durante todo el mes.{" "}
                <strong>
                  Si no podés estar en vivo, vas a tener disponible la grabación durante los 7 días
                  siguientes.
                </strong>
              </p>
            </FilaComoFunciona>

            <FilaComoFunciona
              id="cf-espacio"
              icono={<IconoCelular className="h-5 w-5" />}
              rotulo="TU ESPACIO"
              titulo="Tu espacio propio, durante todo el proceso"
              extra={
                <div className="mt-5 flex flex-wrap gap-4">
                  <MarcoTelefono src="/entusiasmo/captura-1.jpg" alt="Coordenadas y tareas semanales de un participante en su espacio de Entusiasmento" />
                  <MarcoTelefono src="/entusiasmo/captura-2.jpg" alt="El pitch de un participante en su espacio de Entusiasmento" />
                  <MarcoTelefono src="/entusiasmo/captura-3.jpg" alt="Producciones de un participante en su espacio de Entusiasmento" />
                </div>
              }
            >
              <p>
                Vas a tener una app propia y personalizada que abrís desde el celular y tenés a mano
                todos los días. Ahí vas subiendo lo que producís —lo que escribís, grabás, bocetás, pensás
                en voz alta— y nosotros lo miramos y te hacemos aportes sobre tus avances.
              </p>
              <p>
                No es una biblioteca de contenidos para mirar, ni un grupo de mensajes donde lo importante
                se pierde tres días después. Es <strong>el mismo espacio de principio a fin</strong>: todo
                lo que vas haciendo queda ahí, ordenado y a mano. En noviembre vas a poder mirar para atrás
                y ver el camino entero — y eso, cuando arrancás algo que parecía imposible, es la prueba de
                que se movió.
              </p>
            </FilaComoFunciona>

            <FilaComoFunciona id="cf-sesion" icono={<IconoDosPersonas className="h-5 w-5" />} rotulo="SESIÓN 1 A 1" titulo="Sesión 1 a 1">
              <p>
                Es la oportunidad analítica brindada por Nicolás para profundizar al máximo tanto en las
                cuestiones por las que sí avanzás, como en aquellas por las que, desde lo más escondido y
                difícil de aceptar, no avanzás.
              </p>
              <p>
                Vas a poder consultar y hablar de lo más delicado, lo que más te cuesta expresar, con foco
                en hacer crecer tu talento y tu proyecto.
              </p>
            </FilaComoFunciona>

            {/* El único grito de la página — a 19px, mismo tamaño que el párrafo */}
            <FilaComoFunciona id="cf-whatsapp" icono={<IconoWhatsapp className="h-5 w-5" />} rotulo="WHATSAPP" titulo="Soporte por WhatsApp">
              <p>Es muy común encontrarse con cursos enlatados de teoría totalmente impersonalizados.</p>
              <p className="font-bold">NO ES LO QUE PASA AQUÍ.</p>
              <p>
                Vas a disponer de atención de 9 a 18 hs durante la semana por WhatsApp para que saques tus
                dudas, preguntes y no necesites patear a futuro tus avances.
              </p>
            </FilaComoFunciona>

            <FilaComoFunciona id="cf-grupo" icono={<IconoGrupo className="h-5 w-5" />} rotulo="LA RED" titulo="El todos mejora gracias al cada uno">
              <p>
                Trabajamos en contexto grupal, como ocurre en el mundo, en la sociedad, en la familia y en
                los diferentes ámbitos de la vida...
              </p>
              <p>
                Y creemos que la clave del cambio y el crecimiento está en lograr la mejor versión de cada
                quien que se involucra en el conjunto.
              </p>
              <p>
                Vas a encontrarte con personas que apuntan a un mismo objetivo: crecer diferencialmente
                juntos...
              </p>
              <PullQuote>
                ¿Te animás a la aventura de encontrar lo más valioso de vos sin perderte en los otros?
              </PullQuote>
              <p>Y... por si fuera poco...</p>
              <p>
                Contacto con talentos en el deporte, el arte, los emprendimientos, empresas, naturaleza,
                etc., etc.
              </p>
            </FilaComoFunciona>
          </GrupoFilasAnimadas>
        </div>
      </SeccionAnimada>

      {/* 8 · ¡Usamos la IA! — sin fondo oscuro, tarjeta nube con filete naranja */}
      <SeccionAnimada fondo="crema" ancho="ancho">
        <div className="rounded-3xl border-l-4 border-[var(--naranja)] bg-[var(--nube)] p-6 shadow-[0_18px_40px_rgba(36,31,28,0.06)] sm:p-7">
          <h2 className={H2}>¡Usamos la IA! Diferencialmente...</h2>
          <p className="mt-3 text-xl font-semibold opacity-80 sm:text-2xl">Una herramienta, no un reemplazo</p>
          <div className={`${TEXTO} mt-6 space-y-5 opacity-85`}>
            <p>
              Vas a aprender usos concretos de la inteligencia artificial para avanzar más rápido:
              ordenar lo que tenés disperso, probar versiones, resolver en una tarde cosas que antes te
              frenaban semanas. Pero NUNCA le pediremos que piense ni defina lo que nosotros tenemos que
              decidir.
            </p>
            <p>
              La condición que no negociamos: ser los creadores de punta a punta. En un mundo perdido por
              el caos de las dependencias políticas, económicas y científicas... encontramos la solución:
              el aporte particular y subjetivo que cada quien le hace al mundo.
            </p>
            <p>
              Por eso, vas a aprender a usar la IA como herramienta, aun si nunca la usaste, y poniéndola
              a favor de tu proyecto.
            </p>
          </div>
          <div className="mt-8">
            <BotonCTA />
          </div>
        </div>
      </SeccionAnimada>

      {/* 9 · Qué te llevás */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <h2 className={H2}>Qué te llevás</h2>
        <ul className="mt-8 space-y-6">
          {[
            {
              fuerte: "Tu proyecto va a existir",
              resto: ", desde tu cabeza a lo concreto. Construiremos un plan y... vas a dar primeros pasos, concretos y medibles.",
            },
            {
              fuerte: "Atravesar miedos que antes te frenaban.",
              resto: " Mostrar lo que hacés, hablar de eso, ofrecerlo, compartirlo, venderlo y... ¡disfrutar!",
            },
            {
              fuerte: "Vas a descifrar y decidir tu talento",
              resto: ", nombrarlo con tus palabras y ponerlo en marcha.",
            },
            {
              fuerte: "Vas a aprender un estilo de trabajo que impulsa la continuidad:",
              resto: " ritmo propio, autónomo y responsable.",
            },
            {
              fuerte: "¡Aliados!",
              resto: " Otras personas que se entienden en el crecimiento y se encuentran para impulsarse mutuamente.",
            },
          ].map((item, i) => (
            <li key={i} className="flex gap-4">
              <span className={`${TITULO_FONT} shrink-0 text-3xl font-extrabold text-[var(--naranja)]`}>+</span>
              <span className={TEXTO}>
                <strong>{item.fuerte}</strong>
                {item.resto}
              </span>
            </li>
          ))}
        </ul>
      </SeccionAnimada>

      {/* 10 · No esperás al 14 para empezar — única banda de color pleno.
          Única excepción de padding de toda la página: 56px/72px en vez
          del 56px/80px uniforme. */}
      <SeccionAnimada fondo="naranja" className="text-center" padding="py-[40px] md:py-[52px]">
        <h2 className={`${TITULO_FONT} text-[28px] font-bold leading-tight tracking-[-0.01em] sm:text-[36px]`}>
          No esperás al 14 para empezar
        </h2>
        <p className={`${TEXTO} mx-auto mt-4 opacity-95`}>
          Apenas reservás tu lugar, arrancamos. Vas a recibir instrucciones por mail, contenido en video
          y soporte por WhatsApp: lo necesario para llegar al primer taller preparado.
        </p>
        <div className="mt-7">
          <BotonCTA variante="invertido" />
        </div>
      </SeccionAnimada>

      {/* 11 · Para quién es */}
      <SeccionAnimada fondo="crema" ancho="ancho">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className={H3}>Es para vos si:</h2>
            <ul className="mt-5 space-y-4">
              {[
                "Tenés un proyecto dando vueltas hace tiempo y no lo arrancás.",
                "Sentís que tenés algo para dar y todavía no decidiste qué.",
                "Podés sostener tu compromiso de trabajo personal durante tres meses: un taller por mes y continuidad en tu espacio personal cada semana.",
                "Estás dispuesto a ganar disfrute con lo que hacés.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-xl font-bold text-[var(--verde-brote)]">✓</span>
                  <span className={TEXTO}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={H3}>No es para vos si:</h2>
            <ul className="mt-5 space-y-4">
              {[
                <>
                  Tu proyecto ya está avanzado y lo que buscás es hacerlo crecer. Consultá por el
                  siguiente nivel de ENTHEOS.
                </>,
                <>Querés contenido para mirar sin producir nada.</>,
                <>
                  Querés seguir esperando a ver si &ldquo;se te da&rdquo;, en vez de ir a conseguirlo
                  vos.
                </>,
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-xl font-bold text-[var(--tinta)]/60">—</span>
                  <span className={TEXTO}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SeccionAnimada>

      {/* 12 · Quiénes te acompañamos */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <h2 className={H2}>Quiénes te acompañamos</h2>
        <div className="mt-7 flex flex-col gap-7 sm:flex-row sm:items-start">
          <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-3xl sm:mx-0 sm:w-48">
            <Image
              src="/nicolas-sunset.jpg"
              alt="Nicolás Busico"
              width={400}
              height={500}
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
          <div>
            <h3 className={H3}>Nicolás Busico</h3>
            <p className="text-sm font-medium text-[var(--naranja)]">Licenciado en Psicología</p>
            <div className={`${TEXTO} mt-4 space-y-3 opacity-85`}>
              <p>
                Hace más de 8 años acompaña a personas que necesitan definir un rumbo y animarse a crear
                proyectos propios a partir de sus talentos y de lo que les gusta hacer.
              </p>
              <p>
                Asesora a empresas, instituciones educativas, clubes deportivos y sus actores. También
                acompaña a artistas, músicos y emprendedores.
              </p>
              <p>Fundador de ENTHEOS y de actividades creativas para el desarrollo personal.</p>
            </div>
          </div>
        </div>
        <div className="mt-9">
          <h3 className={H3}>Equipo de ENTHEOS</h3>
          <p className={`${TEXTO} mt-3 opacity-85`}>
            Participantes activos que apoyan desde la experiencia misma de atravesar los propios
            desafíos y de lograr, cada vez más, hacer crecer sus talentos y proyectos.
          </p>
        </div>
      </SeccionAnimada>

      {/* 13 · Testimonios — se renderiza solo si hay contenido cargado */}
      {ASSETS.testimonios.length > 0 && (
        <SeccionAnimada fondo="arena" ancho="ancho">
          <h2 className={H2}>Lo dicen ellos</h2>
          <div className="mt-8">
            <Testimonios testimonios={ASSETS.testimonios} />
          </div>
        </SeccionAnimada>
      )}

      {/* 14 · Proyectos que pasaron por acá (carrusel grande) */}
      <SeccionAnimada fondo="crema" ancho="completo">
        <div className="mx-auto max-w-[860px] px-4 sm:px-6">
          <h2 className={H2}>Proyectos que pasaron por acá</h2>
        </div>
        <div className="mt-7">
          <CarruselProyectos />
        </div>
      </SeccionAnimada>

      {/* 15 · Todo lo que entra en los tres meses → precio → El valor diferencial */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <h2 className={H2}>Todo lo que entra en los tres meses</h2>
        {/* Tabla de valor: es una referencia, tiene que verse tranquila —
            sin tarjeta, solo filas separadas por una línea fina. */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse">
            <tbody>
              {[
                ["Entusiasmento — tu espacio propio, los tres meses", "$480.000"],
                ["Tres talleres creativos en vivo — 6 horas, con las grabaciones", "$150.000"],
                ["Una sesión 1 a 1 con Nicolás", "$55.000"],
                ["Soporte por WhatsApp, de 9 a 18, doce semanas", "incluido"],
                ["Red colaborativa de talentos", "incluido"],
              ].map(([nombre, precio]) => (
                <tr key={nombre} className="border-b border-[var(--tinta)]/10 last:border-0">
                  <td className="p-3 text-xl font-bold sm:text-2xl">{nombre}</td>
                  <td className="p-3 text-right text-lg opacity-70 sm:text-xl">{precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`${TEXTO} mt-6`}>
          Por separado, cada cosa: <strong className="font-bold">$685.000</strong>
        </p>

        <div className="mt-8">
          <p className={`${TITULO_FONT} text-[24px] font-normal sm:text-[26px]`}>
            Queremos crecer junto a vos, así que te abrimos la puerta por:
          </p>
          {/* Dos tarjetas de opción, no una tabla de tarifas — una tabla
              pide comparar y calcular; dos tarjetas piden elegir. La de
              pago único es la destacada (chapa con el ahorro real, ya
              calculado — nadie tiene que restar dos cifras de una grilla). */}
          <div className="mt-6 grid items-stretch gap-5 sm:grid-cols-2">
            <div className="flex flex-col rounded-3xl border-2 border-[var(--naranja)] bg-[var(--nube)] p-6 sm:p-7">
              <span className="self-start rounded-full bg-[var(--naranja)] px-3 py-1 text-xs font-bold text-[var(--tinta)]">
                Ahorrás {formatearMontoArs(PRECIOS_ARS.mensual.transferencia * 3 - PRECIOS_ARS.unico.transferencia)}
              </span>
              <p className={`${TEXTO_CHICO} mt-5 font-semibold uppercase tracking-[0.12em] opacity-60`}>
                Pago único
              </p>
              <p className="mt-2 text-[40px] font-extrabold leading-none sm:text-[44px]">
                {formatearMontoArs(PRECIOS_ARS.unico.transferencia)}
              </p>
              <p className="mt-2 text-sm opacity-70">los tres meses, por transferencia</p>
              <p className="mt-4 text-sm opacity-60">
                Por Mercado Pago: {formatearMontoArs(PRECIOS_ARS.unico.mercadopago)}
              </p>
              <div className="mt-6">
                <BotonCTA />
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-[var(--tinta)]/15 bg-[var(--nube)] p-6 sm:p-7">
              <p className={`${TEXTO_CHICO} font-semibold uppercase tracking-[0.12em] opacity-60`}>Mes a mes</p>
              <p className="mt-2 text-[40px] font-extrabold leading-none sm:text-[44px]">
                {formatearMontoArs(PRECIOS_ARS.mensual.transferencia)}
              </p>
              <p className="mt-2 text-sm opacity-70">por mes, por transferencia</p>
              <p className="mt-1 text-sm opacity-70">
                {formatearMontoArs(PRECIOS_ARS.mensual.transferencia * 3)} en total
              </p>
              <p className="mt-4 text-sm opacity-60">
                Por Mercado Pago: {formatearMontoArs(PRECIOS_ARS.mensual.mercadopago)} por mes
              </p>
              <div className="mt-6">
                <BotonCTA />
              </div>
            </div>
          </div>
          <p className={`${TEXTO} mt-6 opacity-80`}>
            <strong>Desde otros países:</strong> USD 500 o EUR 500 el pago único, USD 180 o EUR 180 por
            mes, por transferencia internacional.
          </p>
          <p className="mt-3 text-[19px] font-bold">Inscripción abierta hasta el viernes 11 de septiembre.</p>
        </div>

        <div className="mt-8">
          <h3 className={H3}>El valor diferencial</h3>
          <div className={`${TEXTO} mt-4 space-y-4 opacity-90`}>
            <p>
              No es un programa de prueba. No te ofrecemos un curso más ni videos sin soporte. Tenemos
              testimonios de proyectos que están funcionando hoy y siguen creciendo (no todos están
              incluidos en el carrusel).
            </p>
            <p>
              Te invitamos a concretar los primeros resultados de lo que nunca te animaste hacer, de lo
              que nunca supiste cómo, y para lo que querés activar el coraje de hacerlo.
            </p>
            <p>
              <strong>
                No lo pagues si no estás dispuesto a obtener resultados de verdad, en vos y en tu
                proyecto.
              </strong>
            </p>
          </div>
        </div>
      </SeccionAnimada>

      {/* 16 · Cómo reservás tu lugar + formulario */}
      <SeccionAnimada fondo="crema" id="inscripcion" ancho="ancho">
        <h2 className={H2}>Cómo reservás tu lugar</h2>
        <ol className={`${TEXTO} mt-5 space-y-3`}>
          <li>
            <strong>1.</strong> Completás el formulario de inscripción.
          </li>
          <li>
            <strong>2.</strong> Reservás tu lugar con el pago. Al terminar el formulario te aparecen las
            instrucciones: Mercado Pago o transferencia, nacional o internacional.
          </li>
          <li>
            <strong>3.</strong> ¡Comenzamos desde ya! Antes del 14 te enviaremos instrucciones por mail,
            contenido de video y soporte por WhatsApp: lo necesario para llegar al primer taller
            preparado.
          </li>
        </ol>

        <div className="mt-9">
          <FormularioPreinscripcion />
        </div>
      </SeccionAnimada>

      {/* 17 · Preguntas frecuentes */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <h2 className={H2}>Preguntas frecuentes</h2>
        <div className="mt-8">
          <Acordeon preguntas={PREGUNTAS_FRECUENTES} />
        </div>
      </SeccionAnimada>

      {/* 18 · Cierre */}
      <SeccionAnimada fondo="crema" className="text-center">
        <p className={`${TITULO_FONT} mx-auto max-w-2xl text-[26px] font-normal leading-snug`}>
          El momento llegó, no esperes a estar listo/a...
        </p>
        <p className={`${TITULO_FONT} mx-auto mt-3 max-w-3xl text-[44px] font-extrabold leading-[1.05]`}>
          ¿damos el paso que transforma la vida misma?
        </p>
        <div className="mt-9">
          <BotonCTA />
        </div>
        <p className="mt-4 text-[19px] font-bold opacity-90">Inscripción abierta hasta el viernes 11 de septiembre</p>

        <p className="mt-16 text-xs opacity-50">
          <Link href="/" className="underline">
            ENTHEOS
          </Link>
        </p>
      </SeccionAnimada>
    </div>
  )
}
