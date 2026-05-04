import type { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { autenticarUsuarioPlataforma } from "@/lib/usuarios-plataforma"

const legacyTestUsers = [
  {
    id: "1",
    name: "Administrador",
    email: "admin@escuela.com",
    password: "1234",
    role: "admin",
  },
  {
    id: "2",
    name: "Colaborador",
    email: "colaborador@escuela.com",
    password: "1234",
    role: "colaborador",
  },
  {
    id: "3",
    name: "Participante",
    email: "participante@escuela.com",
    password: "1234",
    role: "participante",
  },
]

function allowLegacyTestUsers() {
  return process.env.NODE_ENV !== "production"
}

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase() || ""
        const password = credentials?.password || ""
        const dbAuth = await autenticarUsuarioPlataforma(email, password)

        if (dbAuth.found) {
          if (!dbAuth.user) {
            return null
          }

          return {
            id: dbAuth.user.id,
            name: dbAuth.user.nombre,
            email: dbAuth.user.email,
            role: dbAuth.user.role,
          }
        }

        if (!allowLegacyTestUsers()) {
          return null
        }

        const user = legacyTestUsers.find(
          (u) => u.email === email && u.password === password
        )

        if (!user) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return url
      }

      try {
        const destino = new URL(url)
        const base = new URL(baseUrl)

        if (destino.origin === base.origin) {
          return `${destino.pathname}${destino.search}${destino.hash}`
        }
      } catch {
        return "/campus"
      }

      return "/campus"
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
      }
      return session
    },
  },
}
