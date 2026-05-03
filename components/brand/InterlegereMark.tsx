type Props = {
  className?: string
}

export default function InterlegereMark({ className = "h-10 w-10" }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M50 10 17 66.5h27.4c5 0 9.7-1.2 13.8-3.4l12.7-7c5.2-2.9 11.1-4.4 17.1-4.4h4.4L50 10Z"
        stroke="currentColor"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.6 66.5h26.2c5.7 0 11.3-1.5 16.2-4.5l12.3-7.3c5.2-3 11.1-4.6 17.1-4.6"
        stroke="currentColor"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M15.4 75.5h31.4c5.8 0 11.5-1.6 16.4-4.8L75 63.4c5.2-3.2 11.1-4.9 17.2-4.9"
        stroke="currentColor"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M52 75.5h31.9L68.8 49.7"
        stroke="currentColor"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
