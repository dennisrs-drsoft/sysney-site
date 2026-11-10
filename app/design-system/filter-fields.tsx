"use client";

import { useId, useState, type ReactNode } from "react";
import { hojeBrasil } from "@/lib/cobrancas";
import styles from "./filter-fields.module.css";

export function FilterField({ label, text, icon, onOpen, children, compact, disabled, triggerId, invalid }: {
  label: string; text: string; icon: ReactNode; onOpen?: () => void;
  compact?: boolean; disabled?: boolean; triggerId?: string; invalid?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const trigger = triggerId ?? id + "-trigger";
  return <span className={compact ? styles.compact : styles.field}>
    {!compact && <span id={id + "-label"}>{label}</span>}
    <button id={trigger} disabled={disabled} aria-invalid={invalid || undefined} className={styles.trigger} type="button" popoverTarget={id}
      aria-label={compact ? `${label}: ${text}` : undefined}
      aria-labelledby={compact ? undefined : id + "-label " + id + "-value"} onClick={onOpen}>
      <span id={id + "-value"}>{text}</span>{icon}
    </button>
    <span id={id} popover="auto" className={styles.panel} role="group" aria-label={label}>
      {children(() => {
        document.getElementById(id)?.hidePopover();
        document.getElementById(trigger)?.focus();
      })}
    </span>
  </span>;
}

const normalizeSearch = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

type Control = { compact?: boolean; disabled?: boolean; triggerId?: string; invalid?: boolean };

export function FilterSelect({ label, value, options, onChange, ...control }: Control & {
  label: string; value: string; options: { value: string; label: string; disabled?: boolean }[]; onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const searchable = options.length >= 8;
  const query = normalizeSearch(search.trim());
  const visible = searchable && query ? options.filter(option => normalizeSearch(option.label).includes(query)) : options;
  return <FilterField {...control} label={label} onOpen={() => setSearch("")} text={options.find(option => option.value === value)?.label ?? ""}
    icon={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" /></svg>}>
    {close => <>
      {searchable && <span className={styles.search}>
        <input type="search" aria-label={`Buscar opções de ${label.toLocaleLowerCase("pt-BR")}`}
          placeholder="Buscar opções…" value={search} onChange={event => setSearch(event.target.value)} />
      </span>}
      {visible.length === 0 && <span className={styles.empty} role="status">Nenhuma opção encontrada.</span>}
      {visible.map(option => <button type="button" key={option.value} disabled={option.disabled}
      className={styles.option} aria-pressed={value === option.value}
      onClick={() => { onChange(option.value); close(); }}>
      {option.label}{value === option.value && <span aria-hidden="true">✓</span>}
    </button>)}
    </>}
  </FilterField>;
}

const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });
const dateKey = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("-");

const shortMonth = new Intl.DateTimeFormat("pt-BR", { month: "short" });

export function FilterDate({ label, value, onChange, mode = "date", min, max, required, ...control }: Control & {
  label: string; value: string; onChange: (value: string) => void;
  mode?: "date" | "month"; min?: string; max?: string; required?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [month, setMonth] = useState(() => new Date(hojeBrasil() + "T12:00:00"));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const today = hojeBrasil();
  const shift = (delta: number) => setMonth(new Date(year, monthIndex + delta, 1));
  const monthly = mode === "month";
  const outside = (key: string) => Boolean(min && key < min || max && key > max);
  const current = monthly ? today.slice(0, 7) : today;
  const formatted = value.split("-").reverse().join("/");
  const typed = draft.split("/").reverse().join("-");
  const valid = (monthly ? /^\d{4}-(0[1-9]|1[0-2])$/.test(typed) : /^\d{4}-\d{2}-\d{2}$/.test(typed) && Number.isFinite(Date.parse(typed)) && new Date(typed).toISOString().slice(0, 10) === typed) && !outside(typed);
  return <FilterField {...control} label={label} text={formatted || (monthly ? "mm/aaaa" : "dd/mm/aaaa")}
    onOpen={() => {
      setDraft(formatted);
      setMonth(new Date((value ? monthly ? value + "-01" : value : hojeBrasil()) + "T12:00:00"));
    }}
    icon={<svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="14" height="12" rx="2" /><path d="M3 9h14M7 3v4m6-4v4" /></svg>}>
    {close => {
      const pick = (date: string) => { onChange(date); close(); };
      return <span className={styles.calendar}>
        {control.compact && <span className={styles.directDate}>
          <input type="text" aria-label={label + " por digitação"} placeholder={monthly ? "mm/aaaa" : "dd/mm/aaaa"}
            maxLength={monthly ? 7 : 10} value={draft} onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (valid) pick(typed);
            }} />
          <button type="button" disabled={!valid} onClick={() => pick(typed)}>Aplicar</button>
        </span>}
        <span className={styles.month}>
          <button type="button" aria-label="Ano anterior" onClick={() => shift(-12)}>«</button>
          {!monthly && <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)}>‹</button>}
          <strong aria-live="polite">{monthly ? year : monthLabel.format(month)}</strong>
          {!monthly && <button type="button" aria-label="Próximo mês" onClick={() => shift(1)}>›</button>}
          <button type="button" aria-label="Próximo ano" onClick={() => shift(12)}>»</button>
        </span>
        {monthly ? <span className={styles.months}>
          {Array.from({ length: 12 }, (_, index) => {
            const date = new Date(year, index, 1);
            const key = dateKey(date).slice(0, 7);
            return <button key={key} type="button" aria-label={monthLabel.format(date)} disabled={outside(key)}
              aria-current={key === current ? "date" : undefined} aria-pressed={key === value}
              onClick={() => pick(key)}>{shortMonth.format(date)}</button>;
          })}
        </span> : <span className={styles.days}>
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <span key={day} aria-hidden="true">{day}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={"blank" + index} />)}
          {Array.from({ length: days }, (_, index) => {
            const date = new Date(year, monthIndex, index + 1);
            const key = dateKey(date);
            return <button type="button" key={key} aria-label={fullDate.format(date)} disabled={outside(key)}
              aria-current={key === today ? "date" : undefined} aria-pressed={key === value}
              onClick={() => pick(key)}>{index + 1}</button>;
          })}
        </span>}
        <span className={styles.actions}>
          {!required && <button type="button" onClick={() => pick("")}>Limpar</button>}
          <button type="button" disabled={outside(current)} onClick={() => pick(current)}>{monthly ? "Este mês" : "Hoje"}</button>
        </span>
      </span>;
    }}
  </FilterField>;
}
