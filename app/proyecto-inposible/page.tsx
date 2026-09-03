import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import FormularioPreinscripcion from "@/components/proyecto-inposible/FormularioPreinscripcion"
import CarruselProyectos from "@/components/proyecto-inposible/CarruselProyectos"
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

function CtaPrincipal({ children = "Quiero mi lugar" }: { children?: string }) {
  return (
    <a href="#inscripcion" className="workspace-button-primary" style={{ color: "#fff" }}>
      {children}
    </a>
  )
}

export default function ProyectoInPosiblePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      {/* 1 · Hero */}
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
          Proyecto In+Posible
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl font-medium text-gray-800 sm:text-2xl">
          Plasmá en tres meses eso que venís postergando toda tu vida.
        </p>
        <p className="mt-3 text-gray-600">Arranca el lunes 14 de septiembre. Cupos dedicados.</p>
        <div className="mt-6">
          <CtaPrincipal />
        </div>
      </section>

      {/* 2 · El problema */}
      <section className="mt-16 space-y-4 text-gray-700 sm:mt-24">
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
          ¡se abre!
        </p>
      </section>

      {/* 3 · Qué es */}
      <section className="workspace-panel-soft mt-12 rounded-3xl p-6 text-lg leading-relaxed text-gray-800 sm:p-8">
        <p>
          <strong>Proyecto In+Posible</strong> es un programa de mentoría personalizada y grupal, para
          descubrir, encender y poner en marcha tu talento, trabajando sobre un proyecto concreto que
          parece imposible de lograr... ¡hasta ahora!
        </p>
      </section>

      {/* 4 · Los tres ejes */}
      <section className="mt-16 space-y-10 sm:mt-24">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">1 · Las coordenadas</h2>
          <p className="mt-3 text-gray-700">
            Claves y coordenadas para empezar tu viaje con un GPS orientado hacia el crecimiento: a qué
            apuntar, por dónde ir, cuáles son los primeros resultados a lograr y... lo más importante:
            ¡quién lo está haciendo!
          </p>
          <p className="mt-3 text-gray-700">
            Porque para dar el primer paso queremos sentirnos seguros — y a la vez es dar el primer paso
            lo que te vuelve seguro de verdad.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">
            2 · Empezar sin esperar a estar listo
          </h2>
          <p className="mt-3 text-gray-700">
            Es en el viaje, caminando, donde nos damos cuenta de qué tenemos que ajustar y actualizar en
            nuestros objetivos. Esperar a tenerlo todo claro y resuelto para dar el primer paso es el
            error más frecuente de los que nunca empiezan. Entonces entra una decisión muy importante:
            ¿voy a prepararme eternamente para nunca empezar? o...
            <br />
            ¡Avanzo para darme cuenta de qué rumbo estoy tomando!
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">3 · Semilla y primeros brotes</h2>
          <p className="mt-3 text-gray-700">
            Dicen que en el interior de la semilla se encuentra la energía y el potencial para dar lugar
            a toda una vida... que, con el deseo y la decisión de ir más allá, emerge de la tierra en sus
            primeros y más delicados brotes.
          </p>
          <p className="mt-3 text-gray-700">
            Un primer paso que, si lo descuidamos, lo olvidamos y lo abandonamos... no crece.
          </p>
          <p className="mt-3 text-gray-700">
            Es aquí donde se juegan los recaudos más importantes y el éxito de tu proyecto: necesitamos
            proteger y darle mucho amor a lo que hacés nacer, para que... de aquí a un año... recuerdes
            este momento y valores: &ldquo;¡Qué lindo es dedicar mi tiempo a lo que amo hacer!&rdquo;.
          </p>
        </div>
      </section>

      {/* 5 · IA — alto en la página, a propósito */}
      <section className="mt-16 rounded-3xl border-2 border-[var(--accent)] bg-white p-6 sm:mt-24 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          ¡Usamos la IA! Diferencialmente...
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-gray-900">
          Una herramienta, no un reemplazo
        </h2>
        <p className="mt-4 text-gray-700">
          Vas a aprender usos concretos de la inteligencia artificial para avanzar más rápido: ordenar
          lo que tenés disperso, probar versiones, resolver en una tarde cosas que antes te frenaban
          semanas. Pero NUNCA le pediremos que piense ni defina lo que nosotros tenemos que decidir.
        </p>
        <p className="mt-4 text-gray-700">
          La condición que no negociamos: ser los creadores de punta a punta. En un mundo perdido por el
          caos de las dependencias políticas, económicas y científicas... encontramos la solución: el
          aporte particular y subjetivo que cada quien le hace al mundo.
        </p>
        <p className="mt-4 text-gray-700">
          Por eso, vas a aprender a usar la IA como herramienta, aun si nunca la usaste, y poniéndola a
          favor de tu proyecto.
        </p>
      </section>

      {/* 6 · Cómo funciona */}
      <section className="mt-16 space-y-10 sm:mt-24">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">Un taller creativo por mes</h2>
          <p className="mt-3 text-gray-700">Tres encuentros en vivo, los lunes a las 19 hs:</p>
          <p className="mt-2 font-semibold text-gray-800">
            {TALLERES.map((t) => t.etiqueta).join(" · ")}
          </p>
          <p className="mt-3 text-gray-700">
            Cada taller creativo de los lunes proporciona 2 hs. de expansión.
          </p>
          <p className="mt-3 text-gray-700">
            En cada uno trabajamos un eje, con claves concretas y casos reales. Te llevás lo necesario
            para empezar a aplicar y recorrer durante todo el mes.{" "}
            <strong>Si no podés estar en vivo, vas a tener disponible la grabación durante los 7
            días siguientes.</strong>
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">
            Tu espacio propio, durante todo el proceso
          </h2>
          <p className="mt-3 text-gray-700">
            Vas a tener una app propia y personalizada que abrís desde el celular y tenés a mano todos
            los días. Ahí vas subiendo lo que producís —lo que escribís, grabás, bocetás, pensás en voz
            alta— y nosotros lo miramos y te hacemos aportes sobre tus avances.
          </p>
          <p className="mt-3 text-gray-700">
            No es una biblioteca de contenidos para mirar, ni un grupo de mensajes donde lo importante se
            pierde tres días después. Es <strong>el mismo espacio de principio a fin</strong>: todo lo
            que vas haciendo queda ahí, ordenado y a mano. En noviembre vas a poder mirar para atrás y
            ver el camino entero — y eso, cuando arrancás algo que parecía imposible, es la prueba de que
            se movió.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">Sesión 1 a 1</h2>
          <p className="mt-3 text-gray-700">
            Es la oportunidad analítica brindada por Nicolás para profundizar al máximo tanto en las
            cuestiones por las que sí avanzás, como en aquellas por las que, desde lo más escondido y
            difícil de aceptar, no avanzás.
          </p>
          <p className="mt-3 text-gray-700">
            Vas a poder consultar y hablar de lo más delicado, lo que más te cuesta expresar, con foco en
            hacer crecer tu talento y tu proyecto.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">Soporte por WhatsApp</h2>
          <p className="mt-3 text-gray-700">
            Es muy común encontrarse con cursos enlatados de teoría totalmente impersonalizados.
          </p>
          <p className="mt-3 text-lg font-bold text-gray-900">NO ES LO QUE PASA AQUÍ.</p>
          <p className="mt-3 text-gray-700">
            Vas a disponer de atención de 9 a 18 hs durante la semana por WhatsApp para que saques tus
            dudas, preguntes y no necesites patear a futuro tus avances.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900">
            El todos mejora gracias al cada uno
          </h2>
          <p className="mt-3 text-gray-700">
            Trabajamos en contexto grupal, como ocurre en el mundo, en la sociedad, en la familia y en
            los diferentes ámbitos de la vida...
          </p>
          <p className="mt-3 text-gray-700">
            Y creemos que la clave del cambio y el crecimiento está en lograr la mejor versión de cada
            quien que se involucra en el conjunto.
          </p>
          <p className="mt-3 text-gray-700">
            Vas a encontrarte con personas que apuntan a un mismo objetivo: crecer diferencialmente
            juntos...
          </p>
          <p className="mt-3 text-gray-700">
            ¿Te animás a la aventura de encontrar lo más valioso de vos sin perderte en los otros?
          </p>
          <p className="mt-3 text-gray-700">Y... por si fuera poco...</p>
          <p className="mt-3 text-gray-700">
            Contacto con talentos en el deporte, el arte, los emprendimientos, empresas, naturaleza,
            etc., etc.
          </p>
        </div>
      </section>

      {/* 7 · No esperás al 14 */}
      <section className="workspace-panel-soft mt-16 rounded-3xl p-6 sm:mt-24 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-gray-900">
          No esperás al 14 para empezar
        </h2>
        <p className="mt-3 text-gray-700">
          Apenas reservás tu lugar arranca el trabajo previo. Vas a recibir la inducción por mail, en
          video y por WhatsApp: lo necesario para llegar al primer taller con algo ya movido.
        </p>
      </section>

      {/* 8 · Qué te vas a llevar */}
      <section className="mt-16 sm:mt-24">
        <h2 className="font-display text-2xl font-semibold text-gray-900">Qué te vas a llevar</h2>
        <div className="mt-6 space-y-4 text-gray-700">
          <p>
            <strong>Tu proyecto va a existir afuera de tu cabeza.</strong> No un plan: primeros pasos
            dados, a la vista.
          </p>
          <p>
            <strong>Vas a haber empezado eso que no te animabas.</strong> Mostrarlo, decirlo, ofrecerlo,
            compartirlo, venderlo... — lo que en tu caso sea.
          </p>
          <p>
            <strong>Vas a saber cuál es tu talento</strong>, poder nombrarlo con tus palabras y señalar
            dónde lo pusiste a trabajar.
          </p>
          <p>
            <strong>Vas a aprender un estilo de trabajo que impulsa la continuidad:</strong> ritmo
            propio, autónomo y responsable.
          </p>
          <p>
            <strong>¡Aliados!</strong> Otras personas que te vieron crecer y se encuentran para
            impulsarse mutuamente.
          </p>
        </div>
      </section>

      {/* 9 · Para quién es */}
      <section className="mt-16 grid gap-8 sm:mt-24 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-gray-900">Es para vos si:</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-700">
            <li>Tenés un proyecto dando vueltas hace tiempo y no lo arrancás.</li>
            <li>Sentís que tenés algo para dar y todavía no decidiste qué.</li>
            <li>
              Podés sostener tu compromiso de trabajo personal durante tres meses: un taller por mes y
              continuidad en tu espacio personal cada semana.
            </li>
            <li>Estás dispuesto a ganar disfrute con lo que hacés.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-gray-900">No es para vos si:</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-700">
            <li>
              Tu proyecto ya está avanzado y lo que buscás es hacerlo crecer. Consultá por el siguiente
              nivel de ENTHEOS.
            </li>
            <li>Querés contenido para mirar sin producir nada.</li>
            <li>
              Querés seguir esperando a ver si &ldquo;se te da&rdquo;, en vez de ir a conseguirlo vos.
            </li>
          </ul>
        </div>
      </section>

      {/* 10 · Quiénes te acompañamos */}
      <section className="mt-16 sm:mt-24">
        <h2 className="font-display text-2xl font-semibold text-gray-900">Quiénes te acompañamos</h2>
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
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
            <h3 className="font-display text-lg font-semibold text-gray-900">Nicolás Busico</h3>
            <p className="text-sm font-medium text-[var(--accent-strong)]">Licenciado en Psicología</p>
            <p className="mt-3 text-gray-700">
              Hace más de 8 años acompaña a personas que necesitan definir un rumbo y animarse a crear
              proyectos propios a partir de sus talentos y de lo que les gusta hacer.
            </p>
            <p className="mt-3 text-gray-700">
              Asesora a empresas, instituciones educativas, clubes deportivos y sus actores. También
              acompaña a artistas, músicos y emprendedores.
            </p>
            <p className="mt-3 text-gray-700">Fundador de ENTHEOS y de actividades creativas para el desarrollo personal.</p>
          </div>
        </div>
        <div className="mt-8">
          <h3 className="font-display text-lg font-semibold text-gray-900">Equipo de ENTHEOS</h3>
          <p className="mt-3 text-gray-700">
            Participantes activos que apoyan desde la experiencia misma de atravesar los propios
            desafíos y de lograr, cada vez más, hacer crecer sus talentos y proyectos.
          </p>
        </div>
      </section>

      {/* 11 · Proyectos que pasaron por acá */}
      <section className="mt-16 sm:mt-24">
        <h2 className="font-display text-2xl font-semibold text-gray-900">Proyectos que pasaron por acá</h2>
        <div className="mt-6">
          <CarruselProyectos />
        </div>
      </section>

      {/* 12 · Qué incluye */}
      <section className="mt-16 sm:mt-24">
        <h2 className="font-display text-2xl font-semibold text-gray-900">Qué incluye, y qué vale cada cosa</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <tbody>
              <tr className="border-b border-[var(--line)]">
                <td className="p-4 text-gray-700">Entusiasmento — tu espacio propio, los tres meses</td>
                <td className="p-4 text-right font-semibold text-gray-800">$480.000</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="p-4 text-gray-700">Tres talleres creativos en vivo — 6 horas, con las grabaciones</td>
                <td className="p-4 text-right font-semibold text-gray-800">$150.000</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="p-4 text-gray-700">Una sesión 1 a 1 con Nicolás</td>
                <td className="p-4 text-right font-semibold text-gray-800">$55.000</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="p-4 text-gray-700">Soporte por WhatsApp, de 9 a 18, doce semanas</td>
                <td className="p-4 text-right font-semibold text-gray-800">incluido</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="p-4 text-gray-700">El grupo: hasta 15 aliados haciendo el mismo camino</td>
                <td className="p-4 text-right font-semibold text-gray-800">incluido</td>
              </tr>
              <tr className="bg-[rgba(255,250,242,0.7)]">
                <td className="p-4 font-semibold text-gray-900">Todo eso, por separado</td>
                <td className="p-4 text-right text-lg font-bold text-gray-900">$685.000</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Para referencia: la mentoría personalizada individual sale $350.000 por mes.
        </p>
      </section>

      {/* 13 · Precio */}
      <section className="mt-16 sm:mt-24">
        <h2 className="font-display text-2xl font-semibold text-gray-900">Precio de primera camada</h2>
        <p className="mt-3 text-gray-700">
          Esta es la primera vez que corre Proyecto In+Posible. El precio de arranque no se repite: en
          enero sube.
        </p>
        <p className="mt-2 font-semibold text-gray-800">
          Inscripción abierta hasta el viernes 11 de septiembre.
        </p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[rgba(255,250,242,0.7)] text-left">
                <th className="p-4 font-semibold text-gray-800"> </th>
                <th className="p-4 font-semibold text-gray-800">Por transferencia</th>
                <th className="p-4 font-semibold text-gray-800">Por Mercado Pago</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--line)]">
                <td className="p-4 text-gray-700">Pago único — los tres meses</td>
                <td className="p-4 font-bold text-gray-900">{formatearMontoArs(PRECIOS_ARS.unico.transferencia)}</td>
                <td className="p-4 text-gray-700">{formatearMontoArs(PRECIOS_ARS.unico.mercadopago)}</td>
              </tr>
              <tr>
                <td className="p-4 text-gray-700">Mes a mes — septiembre, octubre y noviembre</td>
                <td className="p-4 font-bold text-gray-900">
                  {formatearMontoArs(PRECIOS_ARS.mensual.transferencia)} por mes
                </td>
                <td className="p-4 text-gray-700">
                  {formatearMontoArs(PRECIOS_ARS.mensual.mercadopago)} por mes
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-gray-700">
          Señás tu lugar con el primer mes, o con el 50% si vas por el pago único.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          <strong>Desde afuera de Argentina:</strong> USD 500 o EUR 500 el pago único, USD 180 o EUR 180
          por mes, por transferencia internacional.
        </p>
      </section>

      {/* 14 · Cómo reservás tu lugar */}
      <section id="inscripcion" className="mt-16 scroll-mt-6 sm:mt-24">
        <h2 className="font-display text-2xl font-semibold text-gray-900">Cómo reservás tu lugar</h2>
        <ol className="mt-4 space-y-2 text-gray-700">
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

        <div className="mt-8">
          <FormularioPreinscripcion />
        </div>
      </section>

      {/* 15 · Cierre */}
      <section className="mt-16 text-center sm:mt-24">
        <p className="mx-auto max-w-2xl text-xl font-medium text-gray-800">
          El momento llegó, no esperes a estar listo/a... ¿damos el paso que transforma la vida misma?
        </p>
        <div className="mt-6">
          <CtaPrincipal />
        </div>
        <p className="mt-3 text-sm text-gray-500">Inscripción abierta hasta el viernes 11 de septiembre</p>
      </section>

      <p className="mt-16 text-center text-xs text-gray-400">
        <Link href="/" className="underline">
          ENTHEOS
        </Link>
      </p>
    </main>
  )
}
