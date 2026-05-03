import Image from "next/image"

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  subtitleClassName?: string
  logoSrc?: string
  logoAlt?: string
  logoClassName?: string
  logoBlendClassName?: string
  children?: React.ReactNode
}

export default function WorkspaceHero({
  eyebrow,
  title,
  subtitle,
  subtitleClassName = "",
  logoSrc = "/interlegere-icono.png",
  logoAlt = "Logo",
  logoClassName = "",
  logoBlendClassName = "mix-blend-multiply",
  children,
}: Props) {
  return (
    <section className="workspace-hero">
      <div className="workspace-hero-grid">
        <div className="space-y-4">
          {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
          <div className="space-y-3">
            <h1 className="workspace-title">{title}</h1>
            {subtitle && (
              <p className={`workspace-subtitle ${subtitleClassName}`.trim()}>
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>

        <div className="workspace-mark-shell">
          <div className="workspace-mark-glow" />
          <Image
            src={logoSrc}
            alt={logoAlt}
            width={160}
            height={160}
            className={`workspace-mark object-contain ${logoBlendClassName} ${logoClassName}`.trim()}
            priority
          />
        </div>
      </div>
    </section>
  )
}
