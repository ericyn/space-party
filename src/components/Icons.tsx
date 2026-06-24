import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 7H6.42963C7.09834 7 7.7228 6.6658 8.09373 6.1094L8.90627 4.8906C9.2772 4.3342 9.90166 4 10.5704 4H13.4296C14.0983 4 14.7228 4.3342 15.0937 4.8906L15.9063 6.1094C16.2772 6.6658 16.9017 7 17.5704 7H19C20.1046 7 21 7.89543 21 9V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V9C3 7.89543 3.89543 7 5 7Z" />
      <path d="M15 13C15 14.6569 13.6569 16 12 16C10.3431 16 9 14.6569 9 13C9 11.3431 10.3431 10 12 10C13.6569 10 15 11.3431 15 13Z" />
    </svg>
  );
}

export function SoundIcon({
  muted = false,
  ...props
}: IconProps & { muted?: boolean }) {
  return (
    <IconBase {...props}>
      <path d="M4 10h3l4-3.2v10.4L7 14H4z" />
      {muted ? (
        <>
          <path d="m16 10 4 4" />
          <path d="m20 10-4 4" />
        </>
      ) : (
        <>
          <path d="M15 9.2c1.5 1.5 1.5 4.1 0 5.6" />
          <path d="M18 6.5c3 3 3 8 0 11" />
        </>
      )}
    </IconBase>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </IconBase>
  );
}

export function BubbleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="12" r="7.5" />
      <path d="M7.2 9.2c.7-1.5 2-2.4 3.7-2.7" />
      <circle cx="18.5" cy="5" r="1.5" />
    </IconBase>
  );
}

export function PuzzleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5.5h5a2.5 2.5 0 1 1 5 0h5v5a2.5 2.5 0 1 0 0 5v3H4v-4a2.5 2.5 0 1 1 0-5z" />
    </IconBase>
  );
}

export function HandIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M11 9V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M14 9V6a1.5 1.5 0 0 1 3 0v5" />
      <path d="M8 10V8a1.5 1.5 0 0 0-3 0v5c0 5 2.5 8 7 8 4 0 7-2.8 7-7v-3a1.5 1.5 0 0 0-3 0" />
    </IconBase>
  );
}

export function FaceIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M8.5 14.2c1.9 2 5.1 2 7 0" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12.5 4.2 4L19 7" />
    </IconBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </IconBase>
  );
}

export function FruitIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="13.5" r="6.8" />
      <path d="M12 6.7c0-2 1.3-3.3 3.2-3.4" />
      <path d="M5 9.5 19 16" />
    </IconBase>
  );
}

export function MouthIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9.4h.01" />
      <path d="M15 9.4h.01" />
      <ellipse cx="12" cy="15" rx="3.1" ry="2.5" />
    </IconBase>
  );
}

export function PenIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 19l1.2-4.2L15.5 5.5l3 3L9.2 17.8z" />
      <path d="m13.8 7.2 3 3" />
    </IconBase>
  );
}

export function SeesawIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 16V6" />
      <path d="M3.5 8.5 6 6l2.5 2.5" />
      <path d="M18 8v10" />
      <path d="M15.5 15.5 18 18l2.5-2.5" />
    </IconBase>
  );
}
