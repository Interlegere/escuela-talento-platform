"use client"

import { AppSessionProvider } from "@/components/auth/AppSessionProvider"

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppSessionProvider>{children}</AppSessionProvider>
}
