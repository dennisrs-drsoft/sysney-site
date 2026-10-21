import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { calcularOS, resumirOS, type OrdemServico } from "./ordens-servico";
export async function pdfOrdensServico(ordens: OrdemServico[], empresa: string) {
    const resumo = resumirOS(ordens), doc = await PDFDocument.create();
    doc.setTitle("Relatório de serviços prestados");
    doc.setAuthor(empresa.toUpperCase());
    const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([595.28, 841.89]), y = 793;
    const limpar = (s: string) => [...s.normalize("NFC")].map(c => { if (c === "\n" || c === "\r" || c === "\t")
        return c; try {
        font.encodeText(c);
        return c;
    }
    catch {
        return "?";
    } }).join("").replace(/[\r\t]/g, " ");
    function nova() { page = doc.addPage([595.28, 841.89]); page.drawText("Relatório de serviços - continuação", { x: 42, y: 805, size: 9, font: bold }); y = 780; }
    function linha(texto: string, tamanho = 10, forte = false) { if (y < 55)
        nova(); page.drawText(limpar(texto), { x: 42, y, size: tamanho, font: forte ? bold : font, color: rgb(.06, .12, .2) }); y -= tamanho + 6; }
    function bloco(texto: string, tamanho = 10) { for (const paragrafo of limpar(texto).split("\n")) {
        let atual = "";
        for (const palavra of paragrafo.split(/\s+/)) {
            const partes = palavra.length > 65 ? palavra.match(/.{1,65}/g) || [] : [palavra];
            for (const p of partes) {
                const proximo = atual ? `${atual} ${p}` : p;
                if (font.widthOfTextAtSize(proximo, tamanho) > 505) {
                    linha(atual, tamanho);
                    atual = p;
                }
                else
                    atual = proximo;
            }
        }
        linha(atual, tamanho);
    } }
    const moeda = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const data = (d: string) => d.split("-").reverse().join("/");
    linha(`${empresa.toUpperCase()} - RELATÓRIO DE SERVIÇOS`, 15, true);
    bloco(ordens[0].clienteNome, 12);
    linha(`Documento: ${ordens[0].documento}`);
    const lista = [...ordens].sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
    linha(`Período dos atendimentos: ${data(lista[0].data)} a ${data(lista.at(-1)!.diaFim)}`);
    if (lista.some(o => o.estado === "historico"))
        bloco(`Histórico já faturado. NFS-e: ${[...new Set(lista.map(o => o.nota).filter(Boolean))].join(", ")}. Não cobrar novamente. As datas dos atendimentos foram preservadas do relatório original; confira a referência de competência no documento fiscal.`, 9);
    y -= 10;
    for (const o of lista) {
        if (y < 135)
            nova();
        const c = calcularOS(o, o.regras);
        linha(`${data(o.data)} ${o.inicio} até ${data(o.diaFim)} ${o.fim}`, 11, true);
        linha(`Intervalo: ${o.intervaloMinutos} min | Tempo realizado: ${Math.floor(c.minutos / 60)}h${String(c.minutos % 60).padStart(2, "0")} | ${moeda(c.centavos)}`);
        const unidade = o.tipo === "hora" ? `${moeda(o.regras.horaCentavos!)} / hora; ${c.faturaveis} min faturáveis` : o.tipo === "diaria" ? `${o.quantidadeCentesimos / 100} diária(s) a ${moeda(o.regras.diariaCentavos!)}` : "Valor fixo";
        linha(unidade);
        if (o.estado === "historico")
            linha(`Histórico - já faturado na NFS-e ${o.nota || "registrada"}. Não cobrar novamente.`, 9, true);
        bloco(o.descricao);
        y -= 12;
    }
    if (y < 155)
        nova();
    linha(`Subtotal de serviços: ${moeda(resumo.subtotal)}`, 12, true);
    linha(`Acréscimo comercial (${resumo.adicionalBps / 100}%): ${moeda(resumo.adicional)}`, 11);
    linha(`Total: ${moeda(resumo.total)}`, 14, true);
    bloco("Acréscimo comercial conforme regra do cliente; não representa apuração de DAS ou imposto pago. Frações de hora são preservadas no total antes do arredondamento final em centavos.", 8);
    doc.getPages().forEach((p, i) => p.drawText(`Página ${i + 1} de ${doc.getPageCount()}`, { x: 42, y: 28, size: 8, font }));
    return doc.save();
}
