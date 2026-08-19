"use client";

import { useEffect, useRef } from "react";

export function AntiBotFields() {
  const iniciadoEmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (iniciadoEmRef.current) {
      iniciadoEmRef.current.value = String(Date.now());
    }
  }, []);

  return <input ref={iniciadoEmRef} type="hidden" name="iniciadoEm" />;
}
