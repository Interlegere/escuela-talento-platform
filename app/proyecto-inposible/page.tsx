import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import FormularioPreinscripcion from "@/components/proyecto-inposible/FormularioPreinscripcion"
import CarruselProyectos from "@/components/proyecto-inposible/CarruselProyectos"
import SeccionAnimada from "@/components/proyecto-inposible/SeccionAnimada"
import PullQuote from "@/components/proyecto-inposible/PullQuote"
import Collage from "@/components/proyecto-inposible/Collage"
import {
  IconoCalendario,
  IconoCelular,
  IconoDosPersonas,
  IconoWhatsapp,
  IconoGrupo,
} from "@/components/proyecto-inposible/Iconos"
import { formatearMontoArs, PRECIOS_ARS, TALLERES } from "@/lib/proyecto-inposible"
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

// Paleta de esta sola página — se define acá, en un wrapper local, para no
// tocar los tokens globales que usa el resto del portal. El azul noche del
// prompt anterior queda completamente retirado del proyecto.
const PALETA = {
  "--naranja": "#E4783C",
  "--coral": "#C9512F",
  "--dorado": "#F2B441",
  "--arena": "#F2E6CE",
  "--crema": "#FCF8F1",
  "--tierra": "#4A3227",
  "--verde-brote": "#4E7C59",
  "--font-titulo": FUENTE_TITULO_VAR,
  "--font-cuerpo": FUENTE_CUERPO_VAR,
} as React.CSSProperties

// Escala tipográfica única para toda la página.
const TITULO_FONT = "[font-family:var(--font-titulo)]"
const H1 = `${TITULO_FONT} text-[clamp(40px,9vw,76px)] font-extrabold leading-[1.02] tracking-[-0.02em]`
const H2 = `${TITULO_FONT} text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.01em]`
const H3 = `${TITULO_FONT} text-[clamp(21px,3vw,26px)] font-bold`
const MOMENTO = `${TITULO_FONT} text-[clamp(48px,9vw,72px)] font-extrabold leading-[1.05]`
// Único tamaño de cuerpo para las catorce secciones (19px desktop / 18px
// mobile) y único ancho de lectura (680px) — las cuatro excepciones
// permitidas (frase de "Qué es", los tres destacados de los ejes, los
// cuatro momentos grandes, y los números del bloque de precio) se escriben
// con su propio tamaño puntual, no con este token.
const TEXTO = TOKEN_TEXTO
const TEXTO_CHICO = TOKEN_TEXTO_CHICO

function BotonCTA() {
  return (
    <a
      href="#inscripcion"
      className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[var(--naranja)] px-8 text-base font-semibold text-[var(--crema)] transition hover:bg-[var(--coral)]"
    >
      ¡Quiero mi lugar!
    </a>
  )
}

function TarjetaComoFunciona({
  icono,
  titulo,
  children,
  ancha,
}: {
  icono: React.ReactNode
  titulo: string
  children: React.ReactNode
  ancha?: boolean
}) {
  return (
    <div
      className={`rounded-3xl bg-white p-7 shadow-[0_18px_40px_rgba(74,50,39,0.06)] sm:p-8 ${
        ancha ? "sm:col-span-2" : ""
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--arena)] text-[var(--coral)]">
        {icono}
      </div>
      <h3 className={`${H3} mt-5`}>{titulo}</h3>
      <div className={`${TEXTO} mt-3 space-y-3 opacity-85`}>{children}</div>
    </div>
  )
}

function FilaEje({
  numero,
  taller,
  titulo,
  children,
}: {
  numero: string
  taller: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
      <div className="shrink-0 sm:w-52">
        <span className={`${TITULO_FONT} text-6xl font-extrabold leading-none text-[var(--naranja)] sm:text-7xl`}>
          {numero}
        </span>
        <p className={`${TEXTO_CHICO} mt-2 font-semibold uppercase tracking-[0.12em] opacity-60`}>{taller}</p>
      </div>
      <div className="flex-1 rounded-3xl bg-white p-6 shadow-[0_18px_40px_rgba(74,50,39,0.08)] sm:p-8">
        <h3 className={H3}>{titulo}</h3>
        <div className={`${TEXTO} mt-3 space-y-3 opacity-85`}>{children}</div>
      </div>
    </div>
  )
}

export default function ProyectoInPosiblePage() {
  return (
    <div className={`${FUENTES_CLASSNAME} [font-family:var(--font-cuerpo)]`} style={PALETA}>
      {/* 1 · Hero */}
      <SeccionAnimada fondo="crema" separador={false} className="bg-gradient-to-b from-[var(--crema)] to-[var(--arena)]">
        <div className="text-center">
          <p className={`${TEXTO_CHICO} font-semibold uppercase tracking-[0.35em] opacity-60`}>ENTHEOS</p>
          <h1 className={`${H1} mt-5`}>
            Proyecto In<span className="text-[var(--naranja)]">+</span>Posible
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-xl font-medium opacity-80 sm:text-2xl">
            Plasmá en tres meses eso que venís postergando toda tu vida.
          </p>
          <p className="mt-4 opacity-60">Arranca el lunes 14 de septiembre. Cupos dedicados.</p>
          <div className="mt-9">
            <BotonCTA />
          </div>
        </div>
      </SeccionAnimada>

      {/* 2 · Qué es (sube al segundo lugar) */}
      <SeccionAnimada fondo="arena">
        <div className="border-l-8 border-[var(--naranja)] pl-6 sm:pl-8">
          <p className="text-2xl font-medium leading-snug sm:text-3xl">
            <strong className="font-bold">Proyecto In+Posible</strong> es un programa de mentoría
            personalizada y grupal, para descubrir, encender y poner en marcha tu talento, trabajando
            sobre un proyecto concreto que parece imposible de lograr... ¡hasta ahora!
          </p>
        </div>
      </SeccionAnimada>

      {/* 3 · El problema */}
      <SeccionAnimada fondo="crema">
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
        <p className={`${MOMENTO} mt-2 text-[var(--naranja)]`}>¡se abre!</p>
      </SeccionAnimada>

      {/* 4 · Los tres ejes */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <h2 className={H2}>Los tres ejes</h2>
        <p className="mt-3 text-xl font-medium opacity-70 sm:text-2xl">
          Uno por taller. En septiembre, en octubre y en noviembre.
        </p>

        <div className="mt-10 space-y-10 border-l-2 border-[var(--naranja)] pl-6 sm:pl-10">
          <FilaEje numero="1" taller="TALLER 1 · LUNES 14 DE SEPTIEMBRE" titulo="Las coordenadas">
            <p>
              Claves y coordenadas para empezar tu viaje con un GPS orientado hacia el crecimiento: a
              qué apuntar, por dónde ir, cuáles son los primeros resultados a lograr y... lo más
              importante: ¡quién lo está haciendo!
            </p>
            <p>
              Porque para dar el primer paso queremos sentirnos seguros — y a la vez es dar el primer
              paso lo que te vuelve seguro de verdad.
            </p>
            <PullQuote>es dar el primer paso lo que te vuelve seguro de verdad.</PullQuote>
          </FilaEje>

          <FilaEje numero="2" taller="TALLER 2 · LUNES 12 DE OCTUBRE" titulo="Empezar sin esperar a estar listo">
            <p>
              Es en el viaje, caminando, donde nos damos cuenta de qué tenemos que ajustar y actualizar
              en nuestros objetivos. Esperar a tenerlo todo claro y resuelto para dar el primer paso es
              el error más frecuente de los que nunca empiezan. Entonces entra una decisión muy
              importante: ¿voy a prepararme eternamente para nunca empezar? o...
            </p>
            <PullQuote>¡Avanzo para darme cuenta de qué rumbo estoy tomando!</PullQuote>
          </FilaEje>

          <FilaEje
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
            <PullQuote>
              &ldquo;¡Qué lindo es dedicar mi tiempo a lo que amo hacer!&rdquo;
            </PullQuote>
          </FilaEje>
        </div>

        <div className="mt-10">
          <BotonCTA />
        </div>
      </SeccionAnimada>

      {/* 5 · Cómo funciona (+ collage al final) */}
      <SeccionAnimada fondo="crema" ancho="ancho" separador={false}>
        <h2 className={H2}>Cómo funciona</h2>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <TarjetaComoFunciona icono={<IconoCalendario className="h-5 w-5" />} titulo="Un taller creativo por mes">
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
          </TarjetaComoFunciona>

          <TarjetaComoFunciona icono={<IconoCelular className="h-5 w-5" />} titulo="Tu espacio propio, durante todo el proceso">
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
          </TarjetaComoFunciona>

          <TarjetaComoFunciona icono={<IconoDosPersonas className="h-5 w-5" />} titulo="Sesión 1 a 1">
            <p>
              Es la oportunidad analítica brindada por Nicolás para profundizar al máximo tanto en las
              cuestiones por las que sí avanzás, como en aquellas por las que, desde lo más escondido y
              difícil de aceptar, no avanzás.
            </p>
            <p>
              Vas a poder consultar y hablar de lo más delicado, lo que más te cuesta expresar, con foco
              en hacer crecer tu talento y tu proyecto.
            </p>
          </TarjetaComoFunciona>
        </div>

        {/* El único grito de la página — adentro de su propia tarjeta */}
        <div className="mt-5 rounded-3xl bg-white p-7 shadow-[0_18px_40px_rgba(74,50,39,0.06)] sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--arena)] text-[var(--coral)]">
            <IconoWhatsapp className="h-5 w-5" />
          </div>
          <h3 className={`${H3} mt-5`}>Soporte por WhatsApp</h3>
          <p className={`${TEXTO} mt-3 opacity-85`}>
            Es muy común encontrarse con cursos enlatados de teoría totalmente impersonalizados.
          </p>
          <p className={`${MOMENTO} my-6 text-[clamp(32px,7vw,56px)] text-[var(--tierra)]`}>
            NO ES LO QUE PASA AQUÍ.
          </p>
          <p className={`${TEXTO} opacity-85`}>
            Vas a disponer de atención de 9 a 18 hs durante la semana por WhatsApp para que saques tus
            dudas, preguntes y no necesites patear a futuro tus avances.
          </p>
        </div>

        <div className="mt-5 rounded-3xl bg-white p-7 shadow-[0_18px_40px_rgba(74,50,39,0.06)] sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--arena)] text-[var(--coral)]">
            <IconoGrupo className="h-5 w-5" />
          </div>
          <h3 className={`${H3} mt-5`}>El todos mejora gracias al cada uno</h3>
          <div className={`${TEXTO} mt-3 space-y-3 opacity-85`}>
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
          </div>
          <PullQuote>
            ¿Te animás a la aventura de encontrar lo más valioso de vos sin perderte en los otros?
          </PullQuote>
          <div className={`${TEXTO} space-y-3 opacity-85`}>
            <p>Y... por si fuera poco...</p>
            <p>
              Contacto con talentos en el deporte, el arte, los emprendimientos, empresas, naturaleza,
              etc., etc.
            </p>
          </div>
        </div>
      </SeccionAnimada>

      <Collage />

      {/* 6 · ¡Usamos la IA! (baja después de Cómo funciona) */}
      <SeccionAnimada fondo="tierra">
        <h2 className={H2}>¡Usamos la IA! Diferencialmente...</h2>
        <p className="mt-3 text-xl font-semibold opacity-90 sm:text-2xl">Una herramienta, no un reemplazo</p>
        <div className={`${TEXTO} mt-6 space-y-5 opacity-90`}>
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
      </SeccionAnimada>

      {/* 7 · Qué te llevás */}
      <SeccionAnimada fondo="arena">
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

      {/* 8 · No esperás al 14 para empezar — banda naranja */}
      <SeccionAnimada fondo="naranja" className="text-center">
        <h2 className={H2}>No esperás al 14 para empezar</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg opacity-95 sm:text-xl">
          Apenas reservás tu lugar, arrancamos. Vas a recibir instrucciones por mail, contenido en video
          y soporte por WhatsApp: lo necesario para llegar al primer taller preparado.
        </p>
        <div className="mt-7">
          <a
            href="#inscripcion"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[var(--tierra)] px-8 text-base font-semibold text-[var(--crema)] transition hover:opacity-90"
          >
            ¡Quiero mi lugar!
          </a>
        </div>
      </SeccionAnimada>

      {/* 9 · Para quién es */}
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
                  <span className={`${TITULO_FONT} shrink-0 text-xl font-bold text-[var(--naranja)]`}>+</span>
                  <span className={TEXTO}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SeccionAnimada>

      {/* 10 · Quiénes te acompañamos */}
      <SeccionAnimada fondo="arena">
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
            <p className="text-sm font-medium text-[var(--coral)]">Licenciado en Psicología</p>
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

      {/* 11 · Proyectos que pasaron por acá */}
      <SeccionAnimada fondo="blanco" ancho="completo">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className={H2}>Proyectos que pasaron por acá</h2>
        </div>
        <div className="mt-7">
          <CarruselProyectos />
        </div>
      </SeccionAnimada>

      {/* 12 · Todo lo que entra en los tres meses → precio → Por qué vale esto */}
      <SeccionAnimada fondo="crema" ancho="ancho">
        <h2 className={H2}>Todo lo que entra en los tres meses</h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--tierra)]/10">
          <table className="w-full min-w-[420px] border-collapse">
            <tbody>
              {[
                ["Entusiasmento — tu espacio propio, los tres meses", "$480.000"],
                ["Tres talleres creativos en vivo — 6 horas, con las grabaciones", "$150.000"],
                ["Una sesión 1 a 1 con Nicolás", "$55.000"],
                ["Soporte por WhatsApp, de 9 a 18, doce semanas", "incluido"],
                ["El grupo: hasta 15 aliados haciendo el mismo camino", "incluido"],
              ].map(([nombre, precio]) => (
                <tr key={nombre} className="border-b border-[var(--tierra)]/10 last:border-0">
                  <td className="p-4 text-xl font-bold sm:text-2xl">{nombre}</td>
                  <td className="p-4 text-right text-lg opacity-70 sm:text-xl">{precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6">
          Por separado, cada cosa:{" "}
          <span className={`${TITULO_FONT} text-4xl font-extrabold sm:text-5xl`}>$685.000</span>
        </p>

        <div className="mt-14">
          <h2 className={H2}>Entrás por</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--tierra)]/10">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--tierra)]/10 bg-white/40 text-left">
                  <th className="p-4 font-semibold"> </th>
                  <th className="p-4 font-semibold">Por transferencia</th>
                  <th className="p-4 font-semibold">Por Mercado Pago</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--tierra)]/10">
                  <td className="p-4 opacity-80">Pago único — los tres meses</td>
                  <td className="p-4 text-[28px] font-bold sm:text-[32px]">
                    {formatearMontoArs(PRECIOS_ARS.unico.transferencia)}
                  </td>
                  <td className="p-4 opacity-70">{formatearMontoArs(PRECIOS_ARS.unico.mercadopago)}</td>
                </tr>
                <tr>
                  <td className="p-4 opacity-80">Mes a mes</td>
                  <td className="p-4 text-[28px] font-bold sm:text-[32px]">
                    {formatearMontoArs(PRECIOS_ARS.mensual.transferencia)} por mes
                  </td>
                  <td className="p-4 opacity-70">
                    {formatearMontoArs(PRECIOS_ARS.mensual.mercadopago)} por mes
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={`${TEXTO} mt-5 opacity-80`}>
            <strong>Desde otros países:</strong> USD 500 o EUR 500 el pago único, USD 180 o EUR 180 por
            mes, por transferencia internacional.
          </p>
          <p className="mt-3 font-semibold">Inscripción abierta hasta el viernes 11 de septiembre.</p>
          <div className="mt-7">
            <BotonCTA />
          </div>
        </div>

        <div className="mt-14">
          <h3 className={H3}>Por qué vale esto</h3>
          <div className={`${TEXTO} mt-4 space-y-4 opacity-90`}>
            <p>
              No es un programa de prueba. Hace más de ocho años que Nicolás acompaña estos procesos, y
              los proyectos que salieron de ahí están funcionando hoy: los viste recién, uno por uno, con
              nombre propio.
            </p>
            <p>
              Lo nuevo es el formato — los tres talleres, Entusiasmento y la sesión 1 a 1 reunidos en un
              mismo recorrido de tres meses. Este es el precio con el que abre. En enero, cuando arranque
              el próximo ciclo, sube.
            </p>
          </div>
        </div>
      </SeccionAnimada>

      {/* 13 · Cómo reservás tu lugar + formulario */}
      <SeccionAnimada fondo="arena" id="inscripcion" ancho="ancho">
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

      {/* 14 · Cierre */}
      <SeccionAnimada fondo="tierra" separador={false} className="text-center">
        <p className={`${MOMENTO} mx-auto max-w-3xl`}>
          El momento llegó, no esperes a estar listo/a... ¿damos el paso que transforma la vida misma?
        </p>
        <div className="mt-9">
          <BotonCTA />
        </div>
        <p className="mt-4 text-sm opacity-70">Inscripción abierta hasta el viernes 11 de septiembre</p>

        <p className="mt-16 text-xs opacity-50">
          <Link href="/" className="underline">
            ENTHEOS
          </Link>
        </p>
      </SeccionAnimada>
    </div>
  )
}
