"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";

export type SignaturePadHandle = { toDataUrl: () => string | null; clear: () => void };

/** Sign with a finger. A plain canvas: no library, works with touch, pen and mouse. */
export const SignaturePad = forwardRef<SignaturePadHandle, { label: string; onChange?: (signed: boolean) => void }>(function SignaturePad({ label, onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
    }
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    if (!signed) (setSigned(true), onChange?.(true));
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const clear = () => {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setSigned(false);
    onChange?.(false);
  };
  useImperativeHandle(ref, () => ({ toDataUrl: () => (signed ? canvas.current?.toDataURL("image/png") ?? null : null), clear }));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <canvas
        ref={canvas}
        role="img"
        aria-label="Signature box. Draw your signature here."
        data-testid="signature-canvas"
        data-signed={signed}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drawing.current = false)}
        onPointerCancel={() => (drawing.current = false)}
        className="h-32 w-full touch-none rounded-lg border-2 border-dashed bg-white"
      />
      <Button type="button" variant="secondary" small onClick={clear}>
        Clear signature
      </Button>
    </div>
  );
});
