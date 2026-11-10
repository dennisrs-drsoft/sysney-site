"use client";

import { Children, isValidElement, useId, useState, type ComponentProps, type ReactNode } from "react";
import { FilterDate, FilterField, FilterSelect } from "./filter-fields";
import styles from "./filter-fields.module.css";

type FieldProps = {
  label: string;
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
};

function optionText(children: ReactNode): string {
  return Children.toArray(children).map(child => typeof child === "string" || typeof child === "number" ? String(child) : "").join("");
}

function useField({ value, defaultValue, onValueChange }: FieldProps, fallback = "") {
  const triggerId = useId();
  const [internal, setInternal] = useState(() => String(defaultValue ?? fallback));
  const [error, setError] = useState("");
  return {
    triggerId, value: value === undefined ? internal : String(value), error,
    change(next: string) {
      if (value === undefined) setInternal(next);
      setError("");
      onValueChange?.(next);
    },
    invalid(event: React.InvalidEvent<HTMLInputElement | HTMLSelectElement>) {
      event.preventDefault();
      setError(event.currentTarget.validationMessage);
      document.getElementById(triggerId)?.focus();
    },
  };
}

export function FinanceSelect({ children, ...props }: FieldProps & { children: ReactNode }) {
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<ComponentProps<"option">>(child) || child.type !== "option") return [];
    const label = child.props.label ?? optionText(child.props.children);
    return [{ label, value: String(child.props.value ?? label), disabled: child.props.disabled }];
  });
  const field = useField(props, options.find(option => !option.disabled)?.value);
  return <span className={styles.financeControl}>
    <FilterSelect compact label={props.label} options={options} value={field.value} onChange={field.change}
      disabled={props.disabled} triggerId={field.triggerId} invalid={!!field.error} />
    <select hidden aria-hidden="true" tabIndex={-1} name={props.name} required={props.required}
      disabled={props.disabled} value={field.value} onChange={event => field.change(event.currentTarget.value)}
      onInvalid={field.invalid}>
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    {field.error && <span className={styles.error} role="alert">{field.error}</span>}
  </span>;
}

export function FinanceDate({ type = "date", min, max, ...props }: FieldProps & {
  type?: "date" | "month"; min?: string; max?: string;
}) {
  const field = useField(props);
  return <span className={styles.financeControl}>
    <FilterDate compact label={props.label} value={field.value} onChange={field.change} mode={type} min={min} max={max}
      required={props.required} disabled={props.disabled} triggerId={field.triggerId} invalid={!!field.error} />
    <input hidden aria-hidden="true" tabIndex={-1} name={props.name} type={type} min={min} max={max}
      required={props.required} disabled={props.disabled} value={field.value}
      onChange={event => field.change(event.currentTarget.value)} onInvalid={field.invalid} />
    {field.error && <span className={styles.error} role="alert">{field.error}</span>}
  </span>;
}

export function FinanceTime(props: FieldProps) {
  const field = useField(props);
  const [draft, setDraft] = useState("");
  const valid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft);
  return <span className={styles.financeControl}>
    <FilterField compact label={props.label} text={field.value || "hh:mm"} triggerId={field.triggerId}
      disabled={props.disabled} invalid={!!field.error} onOpen={() => setDraft(field.value)}
      icon={<svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg>}>
      {close => <span className={styles.calendar}>
        <span className={styles.search}>Formato de 24 horas
          <input type="text" aria-label={props.label + " (24 h)"} placeholder="hh:mm" maxLength={5} value={draft} onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (valid) { field.change(draft); close(); }
            }} />
        </span>
        <span className={styles.actions}>
          {!props.required && <button type="button" onClick={() => { field.change(""); close(); }}>Limpar</button>}
          <button type="button" disabled={!valid} onClick={() => { field.change(draft); close(); }}>Aplicar horário</button>
        </span>
      </span>}
    </FilterField>
    <input hidden aria-hidden="true" tabIndex={-1} type="time" name={props.name} value={field.value}
      required={props.required} disabled={props.disabled} onChange={event => field.change(event.currentTarget.value)} onInvalid={field.invalid} />
    {field.error && <span className={styles.error} role="alert">{field.error}</span>}
  </span>;
}
