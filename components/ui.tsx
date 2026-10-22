"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Utensils, ArrowRight, LoaderCircle } from "lucide-react";
import { useShop } from "./shop-context";
export function FoodImage({
  image,
  name,
  className = "",
}: {
  image?: string;
  name: string;
  className?: string;
}) {
  const key = image?.split("/").pop()?.split(".")[0] || "";
  const positions: Record<string, string> = {
    adobo: "0% 0%",
    sinigang: "50% 0%",
    pinakbet: "100% 0%",
    lumpia: "0% 100%",
    pancit: "50% 100%",
    rice: "100% 100%",
  };
  if (positions[key])
    return (
      <div
        role="img"
        aria-label={`${name}, illustrative photo`}
        className={"food-image atlas " + className}
        style={{
          backgroundImage: "url(/images/food-atlas.png)",
          backgroundPosition: positions[key],
        }}
      />
    );
  if (image)
    return (
      <img
        className={"food-image " + className}
        src={image}
        alt={name}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
        }}
      />
    );
  return (
    <div className={"food-image food-placeholder " + className}>
      <Utensils size={32} />
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export const statusText: Record<string, string> = {
  pending: "New request",
  accepted: "Accepted",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  cancelled: "Cancelled",
  declined: "Declined",
  no_show: "No-show",
};
export const statusTone: Record<string, string> = {
  pending: "amber",
  accepted: "blue",
  ready: "green",
  picked_up: "neutral",
  cancelled: "red",
  declined: "red",
  no_show: "red",
};
export function Empty({
  icon: Icon = Utensils,
  title,
  description,
  action,
}: {
  icon?: any;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={27} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function LinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
export function Avatar({
  name,
  className = "",
  fileId,
}: {
  name: string;
  className?: string;
  fileId?: string | null;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
  return (
    <span className={"avatar " + className} aria-label={name}>
      {fileId ? <img src={"/api/files/" + fileId} alt={name} /> : initials}
    </span>
  );
}
export function Submit({
  children = "Save",
  disabled = false,
}: {
  children?: ReactNode;
  disabled?: boolean;
}) {
  const { busy } = useShop();
  return (
    <button
      type="submit"
      className="button primary"
      disabled={busy || disabled}
    >
      {busy ? (
        <>
          <LoaderCircle className="spin" size={17} />
          Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Dialog({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { busy } = useShop();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"dialog " + (wide ? "wide" : "")}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog-inner">
        <header>
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function PesoInput({
  name,
  defaultValue,
  required = true,
  min = 0,
  ...props
}: {
  name: string;
  defaultValue?: number;
  required?: boolean;
  min?: number;
  [key: string]: any;
}) {
  return (
    <div className="peso-input">
      <span>₱</span>
      <input
        name={name}
        type="number"
        min={min}
        step="0.01"
        required={required}
        defaultValue={defaultValue}
        {...props}
      />
    </div>
  );
}
export function formData(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
export function pesos(form: FormData, name: string) {
  return Math.round(Number(form.get(name) || 0) * 100);
}
