"use client"

import { useEffect, useMemo, useState } from "react"

type LandingStage =
  | "latencia"
  | "reconocimiento"
  | "desciframiento"
  | "movimiento"
  | "integracion"
  | "apertura"

const stageStyles: Record<
  LandingStage,
  {
    trail: string
    mesh: string
    nodes: string
    arcA: string
    arcB: string
    glowA: string
    glowB: string
    veil: number
    meshOpacity: number
    trailOpacity: number
  }
> = {
  latencia: {
    trail: "translate(0px, 0px) scale(0.88)",
    mesh: "translate(8px, -14px) scale(0.86)",
    nodes: "translate(-14px, 10px) scale(0.92)",
    arcA: "translate(-10px, 8px)",
    arcB: "translate(14px, -8px)",
    glowA: "translate(-18px, 24px) scale(0.84)",
    glowB: "translate(22px, -14px) scale(0.76)",
    veil: 0.44,
    meshOpacity: 0.48,
    trailOpacity: 0.44,
  },
  reconocimiento: {
    trail: "translate(14px, -2px) scale(0.94)",
    mesh: "translate(12px, -4px) scale(0.96)",
    nodes: "translate(-6px, 4px) scale(0.98)",
    arcA: "translate(-4px, 3px)",
    arcB: "translate(8px, -2px)",
    glowA: "translate(-10px, 10px) scale(0.94)",
    glowB: "translate(10px, -4px) scale(0.88)",
    veil: 0.58,
    meshOpacity: 0.58,
    trailOpacity: 0.56,
  },
  desciframiento: {
    trail: "translate(26px, 8px) scale(1.02)",
    mesh: "translate(18px, 4px) scale(1.02)",
    nodes: "translate(8px, -10px) scale(1.03)",
    arcA: "translate(4px, -8px)",
    arcB: "translate(18px, 6px)",
    glowA: "translate(4px, 0px) scale(1)",
    glowB: "translate(14px, 4px) scale(0.96)",
    veil: 0.68,
    meshOpacity: 0.68,
    trailOpacity: 0.66,
  },
  movimiento: {
    trail: "translate(40px, 16px) scale(1.08)",
    mesh: "translate(28px, 18px) scale(1.1)",
    nodes: "translate(20px, -12px) scale(1.08)",
    arcA: "translate(12px, -10px)",
    arcB: "translate(26px, 12px)",
    glowA: "translate(18px, -8px) scale(1.06)",
    glowB: "translate(26px, 12px) scale(1.02)",
    veil: 0.78,
    meshOpacity: 0.78,
    trailOpacity: 0.76,
  },
  integracion: {
    trail: "translate(52px, 10px) scale(1.12)",
    mesh: "translate(38px, 8px) scale(1.12)",
    nodes: "translate(30px, -18px) scale(1.12)",
    arcA: "translate(18px, -12px)",
    arcB: "translate(32px, 8px)",
    glowA: "translate(30px, -18px) scale(1.14)",
    glowB: "translate(28px, 18px) scale(1.08)",
    veil: 0.86,
    meshOpacity: 0.84,
    trailOpacity: 0.82,
  },
  apertura: {
    trail: "translate(66px, -8px) scale(1.16)",
    mesh: "translate(54px, -8px) scale(1.16)",
    nodes: "translate(46px, -20px) scale(1.18)",
    arcA: "translate(26px, -18px)",
    arcB: "translate(42px, 0px)",
    glowA: "translate(40px, -22px) scale(1.18)",
    glowB: "translate(44px, 4px) scale(1.1)",
    veil: 0.92,
    meshOpacity: 0.9,
    trailOpacity: 0.88,
  },
}

export default function LandingScrollShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [stage, setStage] = useState<LandingStage>("latencia")
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => {
      setReduceMotion(media.matches)
    }

    sync()
    media.addEventListener("change", sync)

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-landing-stage]")
    )

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible[0]) {
          const target = visible[0].target as HTMLElement
          const nextStage = target.dataset.landingStage as LandingStage | undefined

          if (nextStage) {
            setStage(nextStage)
          }
        }
      },
      {
        rootMargin: "-24% 0px -28% 0px",
        threshold: [0.15, 0.35, 0.55, 0.75],
      }
    )

    sections.forEach((section) => observer.observe(section))

    return () => {
      media.removeEventListener("change", sync)
      observer.disconnect()
    }
  }, [])

  const current = useMemo(() => stageStyles[stage], [stage])
  const transition = reduceMotion ? "none" : "transform 700ms ease, opacity 700ms ease"

  return (
    <div className="relative" data-stage={stage}>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(250,195,57,0.12),transparent_26%),radial-gradient(circle_at_84%_18%,rgba(45,111,149,0.08),transparent_24%),radial-gradient(circle_at_58%_78%,rgba(31,96,93,0.08),transparent_22%)]"
          style={{ opacity: current.veil, transition }}
        />
        <div
          className="absolute left-[-6rem] top-[6rem] h-[22rem] w-[22rem] rounded-full bg-[rgba(250,195,57,0.12)] blur-3xl"
          style={{ transform: current.glowA, transition }}
        />
        <div
          className="absolute bottom-[12vh] right-[-7rem] h-[25rem] w-[25rem] rounded-full bg-[rgba(45,111,149,0.1)] blur-3xl"
          style={{ transform: current.glowB, transition }}
        />

        <svg
          viewBox="0 0 580 560"
          className="absolute right-[-4rem] top-[10vh] h-[25rem] w-[25rem] opacity-75 sm:h-[31rem] sm:w-[31rem]"
        >
          <g
            style={{
              transform: current.trail,
              transformOrigin: "50% 50%",
              transition,
              opacity: current.trailOpacity,
            }}
          >
            <path
              d="M76 164C126 116 208 106 286 134C350 158 394 214 438 272"
              stroke="rgba(45,111,149,0.32)"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M110 242C170 206 246 208 306 248C354 280 388 332 430 376"
              stroke="rgba(31,96,93,0.24)"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M156 102L202 76L238 112"
              stroke="rgba(250,195,57,0.32)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          <g
            style={{
              transform: current.mesh,
              transformOrigin: "50% 50%",
              transition,
              opacity: current.meshOpacity,
            }}
          >
            <path
              d="M146 118L230 68L306 126L230 180L146 118Z"
              fill="rgba(255,255,255,0.12)"
              stroke="rgba(45,111,149,0.18)"
              strokeWidth="2"
            />
            <path
              d="M258 224L342 176L414 230L344 286L258 224Z"
              fill="rgba(250,195,57,0.12)"
              stroke="rgba(250,195,57,0.18)"
              strokeWidth="2"
            />
            <path
              d="M188 324L260 278L326 326L260 382L188 324Z"
              fill="rgba(31,96,93,0.12)"
              stroke="rgba(31,96,93,0.18)"
              strokeWidth="2"
            />
          </g>

          <g style={{ transform: current.nodes, transformOrigin: "50% 50%", transition }}>
            <circle cx="154" cy="158" r="8" fill="rgba(250,195,57,0.74)" />
            <circle cx="244" cy="104" r="7" fill="rgba(45,111,149,0.62)" />
            <circle cx="314" cy="230" r="7" fill="rgba(31,96,93,0.7)" />
            <circle cx="404" cy="286" r="9" fill="rgba(250,195,57,0.74)" />
            <circle cx="264" cy="326" r="7" fill="rgba(45,111,149,0.64)" />
          </g>

          <g style={{ transform: current.arcA, transformOrigin: "50% 50%", transition }}>
            <path
              d="M182 278C226 248 298 250 346 282"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <circle
              cx="222"
              cy="250"
              r="72"
              fill="rgba(255,255,255,0.26)"
              stroke="rgba(45,111,149,0.16)"
            />
          </g>

          <g style={{ transform: current.arcB, transformOrigin: "50% 50%", transition }}>
            <path
              d="M280 176C324 154 388 170 420 206"
              stroke="rgba(250,195,57,0.2)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <circle
              cx="336"
              cy="338"
              r="56"
              fill="rgba(255,248,237,0.26)"
              stroke="rgba(250,195,57,0.16)"
            />
          </g>
        </svg>
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  )
}
