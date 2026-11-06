"use client";

import { useState } from "react";

const solutions = [
  ["SISBlink", "Uma coleção inteira, um fluxo de venda.", "Catálogo, grade e atendimento conectados ao pedido."],
  ["Sites", "Sua marca merece ser reconhecida.", "Presença digital com direção visual, conteúdo e um próximo passo claro."],
  ["Integrações", "A informação encontra seu caminho.", "Dados comerciais conectados às regras da sua operação."],
];

export function ComponentLab() {
  const [selected, setSelected] = useState(0);
  const [result, setResult] = useState("");
  return <section className="component-lab" aria-labelledby="lab-title">
    <div className="section-heading"><p className="studio-eyebrow">DESIGN SYSTEM / 03 — LABORATÓRIO</p><h2 id="lab-title">Os detalhes fazem<br />a <em>diferença.</em></h2><p>Experimente os componentes. Este formulário de demonstração não envia dados.</p></div>
    <div className="lab-grid">
      <article className="lab-selection">
        <p className="studio-eyebrow">SELEÇÃO / CONTEÚDO</p>
        <div className="lab-options" role="group" aria-label="Solução em destaque">{solutions.map(([name], index) => <button type="button" key={name} aria-pressed={selected === index} onClick={() => setSelected(index)}>{name}<span aria-hidden="true">↗</span></button>)}</div>
        <div className="lab-panel" key={selected} aria-live="polite"><span className="lab-number">0{selected + 1}</span><h3>{solutions[selected][1]}</h3><p>{solutions[selected][2]}</p></div>
        <div className="lab-states"><span className="lab-badge">Disponível</span><span className="lab-badge lab-badge-neutral">Em análise</span><button type="button" className="studio-button" disabled>Indisponível</button></div>
      </article>
      <article>
        <p className="studio-eyebrow">CAMPOS / VALIDAÇÃO / RETORNO</p>
        <form className="lab-form" onSubmit={event => { event.preventDefault(); setResult("Exemplo concluído. Nenhuma informação foi enviada."); }}>
          <label>Como podemos chamar você?<input name="nome-demo" required autoComplete="off" placeholder="Seu nome" /></label>
          <label>Seu próximo projeto<select defaultValue="site"><option value="site">Um site para minha empresa</option><option value="b2b">Uma operação B2B conectada</option></select></label>
          <label>Campo com erro de exemplo<input aria-invalid="true" aria-describedby="demo-error" value="nome@" readOnly /><small id="demo-error">Informe um endereço completo, como nome@empresa.com.</small></label>
          <label className="lab-checkbox"><input type="checkbox" required />Entendi que este é um exemplo local.</label>
          <button className="studio-button" type="submit">Experimentar retorno <span aria-hidden="true">↗</span></button>
          <p role="status" className="lab-feedback">{result}</p>
        </form>
      </article>
    </div>
    <div className="lab-rules">
      <article><p className="studio-eyebrow">TIPOGRAFIA</p><h3>Manrope <em>+ Fraunces.</em></h3><p>Manrope organiza títulos e leitura. Fraunces itálica marca poucas palavras com personalidade. Texto corrido parte de 16 px; detalhes nunca carregam informação essencial sozinhos.</p></article>
      <article><p className="studio-eyebrow">RITMO / SUPERFÍCIES</p><h3>Espaço para respirar.</h3><div className="space-scale" aria-label="Escala de espaçamento: 8, 16, 24, 40 e 64 pixels">{[8,16,24,40,64].map(size => <span key={size}><i style={{height:size}} />{size}</span>)}</div><p>Linhas abertas, recortes assimétricos e contraste entre azul profundo e mineral. As telas reais do produto são protagonistas.</p></article>
      <article><p className="studio-eyebrow">MOVIMENTO / SOM</p><h3>Resposta, sem ruído.</h3><p>Hover de 220 ms, entrada de 700 ms e órbitas lentas. Clique e foco têm feedback sonoro opcional. Som começa desligado; movimento pode ser pausado e respeita a preferência do dispositivo.</p></article>
    </div>
  </section>;
}
