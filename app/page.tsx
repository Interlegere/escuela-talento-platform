import { redirect } from "next/navigation"

// entheosescuela.com se usa hoy como home de la campaña Proyecto
// In+Posible — el login sigue yendo a /campus (ver callbackUrl en
// app/login/page.tsx), esto solo cambia adónde aterriza alguien que
// entra sin sesión al dominio raíz.
export default function Home() {
  redirect("/proyecto-inposible")
}
