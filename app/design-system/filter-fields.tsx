"use client";

import { useId, useState, type ReactNode } from "react";
import { hojeBrasil } from "@/lib/cobrancas";
import styles from "./filter-fields.module.css";

function FilterField({ label, text, icon, onOpen, children }: {
  label: string; text: string; icon: ReactNode; onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  return <div className={styles.field}>
    <span id={id + "-label"}>{label}</span>
    <button id={id + "-trigger"} className={styles.trigger} type="button" popoverTarget={id}
      aria-labelledby={id + "-label " + id + "-value"} onClick={onOpen}>
      <span id={id + "-value"}>{text}</span>{icon}
    </button>
    <div id={id} popover="auto" className={styles.panel} role="group" aria-labelledby={id + "-label"}>
      {children(() => {
        document.getElementById(id)?.hidePopover();
        document.getElementById(id + "-trigger")?.focus();
      })}
    </div>
  </div>;
}

const normalizeSearch = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

export function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const searchable = options.length >= 8;
  const query = normalizeSearch(search.trim());
  const visible = searchable && query ? options.filter(option => normalizeSearch(option.label).includes(query)) : options;
  return <FilterField label={label} onOpen={() => setSearch("")} text={options.find(option => option.value === value)?.label ?? ""}
    icon={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" /></svg>}>
    {close => <>
      {searchable && <div className={styles.search}>
        <input type="search" aria-label={`Buscar opções de ${label.toLocaleLowerCase("pt-BR")}`}
          placeholder="Buscar opções…" value={search} onChange={event => setSearch(event.target.value)} />
      </div>}
      {visible.length === 0 && <p className={styles.empty} role="status">Nenhuma opção encontrada.</p>}
      {visible.map(option => <button type="button" key={option.value}
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

export function FilterDate({ label, value, onChange }: {
  label: string; value: string; onChange: (value: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date(hojeBrasil() + "T12:00:00"));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const today = hojeBrasil();
  const shift = (delta: number) => setMonth(new Date(year, monthIndex + delta, 1));
  return <FilterField label={label} text={value ? value.split("-").reverse().join("/") : "dd/mm/aaaa"}
    onOpen={() => setMonth(new Date((value || hojeBrasil()) + "T12:00:00"))}
    icon={<svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="14" height="12" rx="2" /><path d="M3 9h14M7 3v4m6-4v4" /></svg>}>
    {close => {
      const pick = (date: string) => { onChange(date); close(); };
      return <div className={styles.calendar}>
        <div className={styles.month}>
          <button type="button" aria-label="Ano anterior" onClick={() => shift(-12)}>«</button>
          <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)}>‹</button>
          <strong aria-live="polite">{monthLabel.format(month)}</strong>
          <button type="button" aria-label="Próximo mês" onClick={() => shift(1)}>›</button>
          <button type="button" aria-label="Próximo ano" onClick={() => shift(12)}>»</button>
        </div>
        <div className={styles.days}>
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <span key={day} aria-hidden="true">{day}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={"blank" + index} />)}
          {Array.from({ length: days }, (_, index) => {
            const date = new Date(year, monthIndex, index + 1);
            const key = dateKey(date);
            return <button type="button" key={key} aria-label={fullDate.format(date)}
              aria-current={key === today ? "date" : undefined} aria-pressed={key === value}
              onClick={() => pick(key)}>{index + 1}</button>;
          })}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => pick("")}>Limpar</button>
          <button type="button" onClick={() => pick(hojeBrasil())}>Hoje</button>
        </div>
      </div>;
    }}
  </FilterField>;
}
