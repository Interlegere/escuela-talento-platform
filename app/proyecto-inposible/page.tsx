import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import FormularioPreinscripcion from "@/components/proyecto-inposible/FormularioPreinscripcion"
import CarruselProyectos from "@/components/proyecto-inposible/CarruselProyectos"
import SeccionAnimada from "@/components/proyecto-inposible/SeccionAnimada"
import PullQuote from "@/components/proyecto-inposible/PullQuote"
import {
  IconoCalendario,
  IconoCelular,
  IconoDosPersonas,
  IconoWhatsapp,
  IconoGrupo,
} from "@/components/proyecto-inposible/Iconos"
import { formatearMontoArs, PRECIOS_ARS, TALLERES } from "@/lib/proyecto-inposible"

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

// Paleta de esta sola página, sacada de la foto del atardecer — se define
// acá, en un wrapper local, para no tocar los tokens globales que usa el
// resto del portal (--accent, --background, etc. en app/globals.css).
const PALETA = {
  "--naranja": "#E4855B",
  "--terracota": "#BD6D53",
  "--arena": "#EAE1C8",
  "--crema": "#F7F4EE",
  "--azul-noche": "#2E3440",
  "--gris-cielo": "#BFC1CF",
} as React.CSSProperties

const P_CLARO = "text-[18px] leading-[1.68] text-[var(--azul-noche)] sm:text-[20px]"
const P_CLARO_CHICO = "text-[17px] leading-[1.65] text-[var(--azul-noche)] sm:text-[18px]"
const P_OSCURO = "text-[18px] leading-[1.68] text-[var(--gris-cielo)] sm:text-[20px]"

function BotonCTA({ children = "Quiero mi lugar" }: { children?: string }) {
  return (
    <a
      href="#inscripcion"
      className="inline-flex items-center justify-center rounded-full bg-[var(--naranja)] px-8 py-4 text-base font-semibold text-white transition hover:bg-[var(--terracota)]"
    >
      {children}
    </a>
  )
}

function TarjetaEje({
  numero,
  fecha,
  titulo,
  children,
}: {
  numero: string
  fecha: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col rounded-3xl bg-white p-7 shadow-[0_18px_40px_rgba(46,52,64,0.08)] sm:p-8">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--terracota)]">
        {fecha}
      </span>
      <span className="font-display mt-2 text-6xl font-bold leading-none text-[var(--naranja)] sm:text-7xl">
        {numero}
      </span>
      <h3 className="font-display mt-4 text-xl font-semibold text-[var(--azul-noche)] sm:text-2xl">
        {titulo}
      </h3>
      <div className="mt-3 space-y-3 text-[16px] leading-[1.65] text-[var(--azul-noche)]/85 sm:text-[17px]">
        {children}
      </div>
    </div>
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
      className={`rounded-3xl bg-white p-7 shadow-[0_18px_40px_rgba(46,52,64,0.06)] sm:p-8 ${
        ancha ? "sm:col-span-2" : ""
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--arena)] text-[var(--terracota)]">
        {icono}
      </div>
      <h3 className="font-display mt-5 text-xl font-semibold text-[var(--azul-noche)] sm:text-2xl">
        {titulo}
      </h3>
      <div className="mt-3 space-y-3 text-[16px] leading-[1.65] text-[var(--azul-noche)]/85 sm:text-[17px]">
        {children}
      </div>
    </div>
  )
}

export default function ProyectoInPosiblePage() {
  return (
    <div style={PALETA}>
      {/* 1 · Hero */}
      <SeccionAnimada fondo="noche" separador={false} className="flex min-h-[86vh] items-center">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gris-cielo)]">
            ENTHEOS
          </p>
          <h1 className="font-display mt-5 text-6xl font-bold leading-[1.02] tracking-tight text-[var(--crema)] sm:text-8xl">
            Proyecto In<span className="text-[var(--naranja)]">+</span>Posible
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-xl font-medium text-[var(--gris-cielo)] sm:text-2xl">
            Plasmá en tres meses eso que venís postergando toda tu vida.
          </p>
          <p className="mt-4 text-[var(--gris-cielo)]/80">
            Arranca el lunes 14 de septiembre. Cupos dedicados.
          </p>
          <div className="mt-9">
            <BotonCTA />
          </div>
        </div>
      </SeccionAnimada>

      {/* 2 · El problema */}
      <SeccionAnimada fondo="crema">
        <div className={`${P_CLARO} space-y-6`}>
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
        <p className="font-display mt-2 text-5xl font-bold text-[var(--naranja)] sm:text-7xl">
          ¡se abre!
        </p>
      </SeccionAnimada>

      {/* 3 · Qué es */}
      <SeccionAnimada fondo="arena">
        <p className="font-display text-center text-2xl font-medium leading-snug text-[var(--azul-noche)] sm:text-4xl">
          <strong className="font-semibold">Proyecto In+Posible</strong> es un programa de mentoría
          personalizada y grupal, para descubrir, encender y poner en marcha tu talento, trabajando
          sobre un proyecto concreto que parece imposible de lograr... ¡hasta ahora!
        </p>
      </SeccionAnimada>

      {/* 4 · Los tres ejes */}
      <SeccionAnimada fondo="crema" ancho="ancho">
        <div className="flex flex-col gap-6 sm:flex-row">
          <TarjetaEje numero="1" fecha="14/09" titulo="Las coordenadas">
            <p>
              Claves y coordenadas para empezar tu viaje con un GPS orientado hacia el crecimiento: a
              qué apuntar, por dónde ir, cuáles son los primeros resultados a lograr y... lo más
              importante: ¡quién lo está haciendo!
            </p>
            <p>
              Porque para dar el primer paso queremos sentirnos seguros — y a la vez es dar el primer
              paso lo que te vuelve seguro de verdad.
            </p>
          </TarjetaEje>

          <TarjetaEje numero="2" fecha="12/10" titulo="Empezar sin esperar a estar listo">
            <p>
              Es en el viaje, caminando, donde nos damos cuenta de qué tenemos que ajustar y actualizar
              en nuestros objetivos. Esperar a tenerlo todo claro y resuelto para dar el primer paso es
              el error más frecuente de los que nunca empiezan. Entonces entra una decisión muy
              importante: ¿voy a prepararme eternamente para nunca empezar? o...
            </p>
            <PullQuote>¡Avanzo para darme cuenta de qué rumbo estoy tomando!</PullQuote>
          </TarjetaEje>

          <TarjetaEje numero="3" fecha="09/11" titulo="Semilla y primeros brotes">
            <p>
              Dicen que en el interior de la semilla se encuentra la energía y el potencial para dar
              lugar a toda una vida... que, con el deseo y la decisión de ir más allá, emerge de la
              tierra en sus primeros y más delicados brotes.
            </p>
            <PullQuote>
              Un primer paso que, si lo descuidamos, lo olvidamos y lo abandonamos... no crece.
            </PullQuote>
            <p>
              Es aquí donde se juegan los recaudos más importantes y el éxito de tu proyecto:
              necesitamos proteger y darle mucho amor a lo que hacés nacer, para que... de aquí a un
              año... recuerdes este momento y valores: &ldquo;¡Qué lindo es dedicar mi tiempo a lo que
              amo hacer!&rdquo;.
            </p>
          </TarjetaEje>
        </div>
      </SeccionAnimada>

      {/* 5 · IA — el bloque más diferencial */}
      <SeccionAnimada fondo="noche">
        <p className="text-xs font-semibold tracking-[0.18em] text-[var(--naranja)]">
          ¡Usamos la IA! Diferencialmente...
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold text-[var(--crema)] sm:text-5xl">
          Una herramienta, no un reemplazo
        </h2>
        <div className={`${P_OSCURO} mt-6 space-y-5`}>
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
      </SeccionAnimada>

      {/* 6 · Cómo funciona */}
      <SeccionAnimada fondo="crema" ancho="ancho">
        <div className="grid gap-5 sm:grid-cols-2">
          <TarjetaComoFunciona icono={<IconoCalendario className="h-5 w-5" />} titulo="Un taller creativo por mes">
            <p>Tres encuentros en vivo, los lunes a las 19 hs:</p>
            <p className="font-semibold text-[var(--azul-noche)]">
              {TALLERES.map((t) => t.etiqueta).join(" · ")}
            </p>
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

          <TarjetaComoFunciona icono={<IconoWhatsapp className="h-5 w-5" />} titulo="Soporte por WhatsApp">
            <p>
              Es muy común encontrarse con cursos enlatados de teoría totalmente impersonalizados.
            </p>
            <p>
              Vas a disponer de atención de 9 a 18 hs durante la semana por WhatsApp para que saques tus
              dudas, preguntes y no necesites patear a futuro tus avances.
            </p>
          </TarjetaComoFunciona>
        </div>

        {/* El único grito de toda la página */}
        <p className="font-display my-10 text-center text-5xl font-bold text-[var(--azul-noche)] sm:text-7xl">
          NO ES LO QUE PASA AQUÍ.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <TarjetaComoFunciona icono={<IconoGrupo className="h-5 w-5" />} titulo="El todos mejora gracias al cada uno" ancha>
            <p>
              Trabajamos en contexto grupal, como ocurre en el mundo, en la sociedad, en la familia y en
              los diferentes ámbitos de la vida...
            </p>
            <p>
              Y creemos que la clave del cambio y el crecimiento está en lograr la mejor versión de cada
              quien que se involucra en el conjunto.
            </p>
            <p>Vas a encontrarte con personas que apuntan a un mismo objetivo: crecer diferencialmente juntos...</p>
          </TarjetaComoFunciona>
        </div>

        <PullQuote>
          ¿Te animás a la aventura de encontrar lo más valioso de vos sin perderte en los otros?
        </PullQuote>

        <div className={`${P_CLARO} space-y-3`}>
          <p>Y... por si fuera poco...</p>
          <p>
            Contacto con talentos en el deporte, el arte, los emprendimientos, empresas, naturaleza,
            etc., etc.
          </p>
        </div>
      </SeccionAnimada>

      {/* 7 · No esperás al 14 */}
      <SeccionAnimada fondo="arena">
        <h2 className="font-display text-2xl font-semibold text-[var(--azul-noche)] sm:text-4xl">
          No esperás al 14 para empezar
        </h2>
        <p className={`${P_CLARO} mt-4`}>
          Apenas reservás tu lugar arranca el trabajo previo. Vas a recibir la inducción por mail, en
          video y por WhatsApp: lo necesario para llegar al primer taller con algo ya movido.
        </p>
      </SeccionAnimada>

      {/* 8 · Qué te vas a llevar */}
      <SeccionAnimada fondo="crema">
        <h2 className="font-display text-2xl font-semibold text-[var(--azul-noche)] sm:text-4xl">
          Qué te vas a llevar
        </h2>
        <ul className="mt-7 space-y-5">
          {[
            <>
              <strong>Tu proyecto va a existir afuera de tu cabeza.</strong> No un plan: primeros pasos
              dados, a la vista.
            </>,
            <>
              <strong>Vas a haber empezado eso que no te animabas.</strong> Mostrarlo, decirlo,
              ofrecerlo, compartirlo, venderlo... — lo que en tu caso sea.
            </>,
            <>
              <strong>Vas a saber cuál es tu talento</strong>, poder nombrarlo con tus palabras y señalar
              dónde lo pusiste a trabajar.
            </>,
            <>
              <strong>Vas a aprender un estilo de trabajo que impulsa la continuidad:</strong> ritmo
              propio, autónomo y responsable.
            </>,
            <>
              <strong>¡Aliados!</strong> Otras personas que te vieron crecer y se encuentran para
              impulsarse mutuamente.
            </>,
          ].map((item, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-display shrink-0 text-2xl font-bold text-[var(--naranja)]">+</span>
              <span className={P_CLARO}>{item}</span>
            </li>
          ))}
        </ul>
      </SeccionAnimada>

      {/* 9 · Para quién es */}
      <SeccionAnimada fondo="arena" ancho="ancho">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--azul-noche)] sm:text-2xl">
              Es para vos si:
            </h2>
            <ul className="mt-5 space-y-4">
              {[
                "Tenés un proyecto dando vueltas hace tiempo y no lo arrancás.",
                "Sentís que tenés algo para dar y todavía no decidiste qué.",
                "Podés sostener tu compromiso de trabajo personal durante tres meses: un taller por mes y continuidad en tu espacio personal cada semana.",
                "Estás dispuesto a ganar disfrute con lo que hacés.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="font-display shrink-0 text-xl font-bold text-[var(--naranja)]">+</span>
                  <span className={P_CLARO_CHICO}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--azul-noche)] sm:text-2xl">
              No es para vos si:
            </h2>
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
                  <span className="font-display shrink-0 text-xl font-bold text-[var(--naranja)]">+</span>
                  <span className={P_CLARO_CHICO}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SeccionAnimada>

      {/* 10 · Quiénes te acompañamos */}
      <SeccionAnimada fondo="crema">
        <h2 className="font-display text-2xl font-semibold text-[var(--azul-noche)] sm:text-4xl">
          Quiénes te acompañamos
        </h2>
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
            <h3 className="font-display text-lg font-semibold text-[var(--azul-noche)]">
              Nicolás Busico
            </h3>
            <p className="text-sm font-medium text-[var(--terracota)]">Licenciado en Psicología</p>
            <div className={`${P_CLARO_CHICO} mt-4 space-y-3`}>
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
          <h3 className="font-display text-lg font-semibold text-[var(--azul-noche)]">
            Equipo de ENTHEOS
          </h3>
          <p className={`${P_CLARO_CHICO} mt-3`}>
            Participantes activos que apoyan desde la experiencia misma de atravesar los propios
            desafíos y de lograr, cada vez más, hacer crecer sus talentos y proyectos.
          </p>
        </div>
      </SeccionAnimada>

      {/* 11 · Proyectos que pasaron por acá */}
      <SeccionAnimada fondo="blanco" ancho="completo">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--azul-noche)] sm:text-4xl">
            Proyectos que pasaron por acá
          </h2>
        </div>
        <div className="mt-7">
          <CarruselProyectos />
        </div>
      </SeccionAnimada>

      {/* 12 · Qué incluye + 13 · Precio */}
      <SeccionAnimada fondo="noche" ancho="ancho">
        <h2 className="font-display text-2xl font-semibold text-[var(--crema)] sm:text-4xl">
          Qué incluye, y qué vale cada cosa
        </h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <tbody>
              <tr className="border-b border-white/10">
                <td className="p-4 text-[var(--gris-cielo)]">
                  Entusiasmento — tu espacio propio, los tres meses
                </td>
                <td className="p-4 text-right font-semibold text-[var(--crema)]">$480.000</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-4 text-[var(--gris-cielo)]">
                  Tres talleres creativos en vivo — 6 horas, con las grabaciones
                </td>
                <td className="p-4 text-right font-semibold text-[var(--crema)]">$150.000</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-4 text-[var(--gris-cielo)]">Una sesión 1 a 1 con Nicolás</td>
                <td className="p-4 text-right font-semibold text-[var(--crema)]">$55.000</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-4 text-[var(--gris-cielo)]">
                  Soporte por WhatsApp, de 9 a 18, doce semanas
                </td>
                <td className="p-4 text-right font-semibold text-[var(--crema)]">incluido</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-4 text-[var(--gris-cielo)]">
                  El grupo: hasta 15 aliados haciendo el mismo camino
                </td>
                <td className="p-4 text-right font-semibold text-[var(--crema)]">incluido</td>
              </tr>
              <tr className="bg-white/5">
                <td className="p-4 font-semibold text-[var(--crema)]">Todo eso, por separado</td>
                <td className="p-4 text-right text-lg font-bold text-[var(--crema)]">$685.000</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-[var(--gris-cielo)]/80">
          Para referencia: la mentoría personalizada individual sale $350.000 por mes.
        </p>

        <div className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-[var(--crema)] sm:text-4xl">
            Precio de primera camada
          </h2>
          <p className={`${P_OSCURO} mt-4`}>
            Esta es la primera vez que corre Proyecto In+Posible. El precio de arranque no se repite: en
            enero sube.
          </p>
          <p className="mt-2 font-semibold text-[var(--crema)]">
            Inscripción abierta hasta el viernes 11 de septiembre.
          </p>

          <p className="font-display my-8 text-6xl font-bold text-[var(--naranja)] sm:text-8xl">
            {formatearMontoArs(PRECIOS_ARS.unico.transferencia)}
          </p>
          <p className="-mt-6 mb-8 text-sm text-[var(--gris-cielo)]">
            pago único, los tres meses, por transferencia
          </p>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left">
                  <th className="p-4 font-semibold text-[var(--crema)]"> </th>
                  <th className="p-4 font-semibold text-[var(--crema)]">Por transferencia</th>
                  <th className="p-4 font-semibold text-[var(--crema)]">Por Mercado Pago</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/10">
                  <td className="p-4 text-[var(--gris-cielo)]">Pago único — los tres meses</td>
                  <td className="p-4 font-bold text-[var(--naranja)]">
                    {formatearMontoArs(PRECIOS_ARS.unico.transferencia)}
                  </td>
                  <td className="p-4 text-[var(--gris-cielo)]">
                    {formatearMontoArs(PRECIOS_ARS.unico.mercadopago)}
                  </td>
                </tr>
                <tr>
                  <td className="p-4 text-[var(--gris-cielo)]">
                    Mes a mes — septiembre, octubre y noviembre
                  </td>
                  <td className="p-4 font-bold text-[var(--naranja)]">
                    {formatearMontoArs(PRECIOS_ARS.mensual.transferencia)} por mes
                  </td>
                  <td className="p-4 text-[var(--gris-cielo)]">
                    {formatearMontoArs(PRECIOS_ARS.mensual.mercadopago)} por mes
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={`${P_OSCURO} mt-5`}>
            Señás tu lugar con el primer mes, o con el 50% si vas por el pago único.
          </p>
          <p className="mt-3 text-sm text-[var(--gris-cielo)]">
            <strong className="text-[var(--crema)]">Desde afuera de Argentina:</strong> USD 500 o EUR
            500 el pago único, USD 180 o EUR 180 por mes, por transferencia internacional.
          </p>
        </div>
      </SeccionAnimada>

      {/* 14 · Cómo reservás tu lugar */}
      <SeccionAnimada fondo="crema" id="inscripcion" ancho="ancho">
        <h2 className="font-display text-2xl font-semibold text-[var(--azul-noche)] sm:text-4xl">
          Cómo reservás tu lugar
        </h2>
        <ol className={`${P_CLARO} mt-5 space-y-3`}>
          <li>
            <strong>1.</strong> Completás el formulario de inscripción.
          </li>
          <li>
            <strong>2.</strong> Señás tu lugar por transferencia o por Mercado Pago.
          </li>
          <li>
            <strong>3.</strong> Empezás antes del 14. Desde que reservás arranca la inducción: mails,
            videos y WhatsApp con trabajo previo, para que el primer taller no te agarre desde cero.
          </li>
        </ol>

        <div className="mt-9">
          <FormularioPreinscripcion />
        </div>
      </SeccionAnimada>

      {/* 15 · Cierre */}
      <SeccionAnimada fondo="noche" separador={false} className="text-center">
        <p className="font-display mx-auto max-w-3xl text-4xl font-bold leading-tight text-[var(--crema)] sm:text-6xl">
          El momento llegó, no esperes a estar listo/a... ¿damos el paso que transforma la vida misma?
        </p>
        <div className="mt-9">
          <BotonCTA />
        </div>
        <p className="mt-4 text-sm text-[var(--gris-cielo)]">
          Inscripción abierta hasta el viernes 11 de septiembre
        </p>

        <p className="mt-16 text-xs text-[var(--gris-cielo)]/60">
          <Link href="/" className="underline">
            ENTHEOS
          </Link>
        </p>
      </SeccionAnimada>
    </div>
  )
}
