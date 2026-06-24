import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState = "idle" | "requesting" | "ready" | "error";

function cameraMessage(error: unknown): string {
  if (!(error instanceof DOMException))
    return "The camera could not be started. Try another camera.";
  if (error.name === "NotAllowedError")
    return "Camera access was blocked. Allow it in your browser settings, then try again.";
  if (error.name === "NotFoundError")
    return "No camera was found. Connect a webcam and try again.";
  if (error.name === "NotReadableError")
    return "The camera is busy in another app. Close that app and try again.";
  if (error.name === "OverconstrainedError")
    return "This camera cannot provide a compatible video size. Choose another camera.";
  return "The camera could not be started. Check the connection and browser permissions.";
}

export function useCamera(
  initialDeviceId: string,
  onDeviceChange: (id: string) => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startToken = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    startToken.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setState("idle");
  }, []);

  const start = useCallback(
    async (requestedDeviceId = initialDeviceId) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "Camera access requires a current browser and a secure HTTPS connection.",
        );
        setState("error");
        return false;
      }
      const token = (startToken.current += 1);
      setState("requesting");
      setError("");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: requestedDeviceId
              ? { exact: requestedDeviceId }
              : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
        if (token !== startToken.current) {
          nextStream.getTracks().forEach((track) => track.stop());
          return false;
        }
        streamRef.current = nextStream;
        setStream(nextStream);
        const activeDeviceId =
          nextStream.getVideoTracks()[0]?.getSettings().deviceId ??
          requestedDeviceId;
        onDeviceChange(activeDeviceId);
        const available = (
          await navigator.mediaDevices.enumerateDevices()
        ).filter((device) => device.kind === "videoinput");
        if (token !== startToken.current) return false;
        setDevices(available);
        setState("ready");
        return true;
      } catch (reason) {
        if (token !== startToken.current) return false;
        setError(cameraMessage(reason));
        setState("error");
        return false;
      }
    },
    [initialDeviceId, onDeviceChange],
  );

  useEffect(() => stop, [stop]);

  return { videoRef, stream, devices, state, error, start, stop };
}
