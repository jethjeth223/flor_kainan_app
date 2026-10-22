"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Minus, Plus, RotateCcw } from "lucide-react";
import {
  constrainImage,
  type ImageTransform as Transform,
} from "@/lib/image-transform";

type Point = { x: number; y: number };
const initial: Transform = { scale: 1, x: 0, y: 0 };

export function ImageViewer({
  src,
  title,
  historyToken,
  onClose,
}: {
  src: string;
  title: string;
  historyToken: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [position, setPosition] = useState<Transform>(initial);
  const positionRef = useRef(initial);
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{
    distance: number;
    midpoint: Point;
    position: Transform;
  } | null>(null);
  function apply(next: Transform) {
    const value = constrainImage(
      next,
      {
        width: image.current?.clientWidth || 0,
        height: image.current?.clientHeight || 0,
      },
      {
        width: stage.current?.clientWidth || 0,
        height: stage.current?.clientHeight || 0,
      },
    );
    positionRef.current = value;
    setPosition(value);
  }
  function zoom(scale: number) {
    const previous = positionRef.current;
    apply({
      scale,
      x: (previous.x * scale) / previous.scale,
      y: (previous.y * scale) / previous.scale,
    });
  }
  function close() {
    if (window.history.state?.kainanImage === historyToken)
      window.history.back();
    else closeRef.current();
  }
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onBack = () => {
      if (window.history.state?.kainanImage !== historyToken)
        closeRef.current();
    };
    window.addEventListener("popstate", onBack);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(positionRef.current.scale + (event.deltaY < 0 ? 0.25 : -0.25));
    };
    const viewport = stage.current;
    viewport?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("popstate", onBack);
      viewport?.removeEventListener("wheel", onWheel);
      document.body.style.overflow = previousOverflow;
      el?.close();
    };
  }, [historyToken]);
  function startPinch() {
    const points = [...pointers.current.values()];
    if (points.length < 2) {
      pinch.current = null;
      return;
    }
    pinch.current = {
      distance: Math.hypot(
        points[0].x - points[1].x,
        points[0].y - points[1].y,
      ),
      midpoint: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      },
      position: positionRef.current,
    };
  }
  return (
    <dialog
      ref={dialog}
      className="image-viewer"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="image-viewer-toolbar">
        <button type="button" onClick={close}>
          <ArrowLeft size={22} />
          <span>Back to chat</span>
        </button>
        <span className="image-viewer-title">{title}</span>
      </header>
      <div
        ref={stage}
        className="image-viewer-stage"
        onDoubleClick={() => zoom(positionRef.current.scale > 1 ? 1 : 2.5)}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          startPinch();
        }}
        onPointerMove={(event) => {
          const old = pointers.current.get(event.pointerId);
          if (!old) return;
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (pointers.current.size > 1 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            const scale = Math.min(
              5,
              Math.max(
                1,
                (pinch.current.position.scale * distance) /
                  Math.max(1, pinch.current.distance),
              ),
            );
            const ratio = scale / pinch.current.position.scale;
            const bounds = event.currentTarget.getBoundingClientRect();
            apply({
              scale,
              x:
                (a.x + b.x) / 2 -
                bounds.left -
                bounds.width / 2 -
                (pinch.current.midpoint.x -
                  bounds.left -
                  bounds.width / 2 -
                  pinch.current.position.x) *
                  ratio,
              y:
                (a.y + b.y) / 2 -
                bounds.top -
                bounds.height / 2 -
                (pinch.current.midpoint.y -
                  bounds.top -
                  bounds.height / 2 -
                  pinch.current.position.y) *
                  ratio,
            });
          } else if (positionRef.current.scale > 1)
            apply({
              ...positionRef.current,
              x: positionRef.current.x + event.clientX - old.x,
              y: positionRef.current.y + event.clientY - old.y,
            });
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          startPinch();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          startPinch();
        }}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=")
            zoom(positionRef.current.scale + 0.5);
          if (event.key === "-") zoom(positionRef.current.scale - 0.5);
          if (event.key === "0") apply(initial);
        }}
        tabIndex={0}
        aria-label="Image. Pinch to zoom, drag to move, or use the zoom buttons."
      >
        {failed ? (
          <p role="alert">The image could not load. Go back and try again.</p>
        ) : (
          <img
            ref={image}
            src={src}
            alt={title}
            draggable={false}
            onError={() => setFailed(true)}
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${position.scale})`,
            }}
          />
        )}
      </div>
      <footer className="image-viewer-controls">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={position.scale <= 1}
          onClick={() => zoom(position.scale - 0.5)}
        >
          <Minus size={22} />
        </button>
        <output aria-live="polite">{Math.round(position.scale * 100)}%</output>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={position.scale >= 5}
          onClick={() => zoom(position.scale + 0.5)}
        >
          <Plus size={22} />
        </button>
        <button type="button" onClick={() => apply(initial)}>
          <RotateCcw size={18} /> Reset
        </button>
        <span>Pinch to zoom · Drag to move</span>
      </footer>
    </dialog>
  );
}
