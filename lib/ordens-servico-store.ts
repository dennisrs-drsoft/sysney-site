import { TableClient, type TableEntityResult, type TransactionAction } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { createHash } from "node:crypto";
import { calcularOS, validarEntradaOS, validarRegrasOS, resumirOS, selecionarParaCobrancaOS, textoOS, dataOS, type OrdemServico, type LoteOS, type RegrasOS, type PreferenciasCobrancaOS } from "./ordens-servico";
import { novoEmail, emailsValidos, type EmailCobranca } from "./emails-cobranca";
import { pdfOrdensServico } from "./ordens-servico-pdf";
import type { Plano, Cobranca, Empresa } from "./cobrancas";
import { lerExcelOS } from "./ordens-servico-excel";
import { MAX_ATENDIMENTOS_EXCEL_OS, MAX_NOVOS_LOTE_EXCEL_OS } from "./ordens-servico-limites";
type Registro = TableEntityResult<{
    json: string;
}> & {
    rowKey: string;
};
type Salva = OrdemServico & {
    versao: string;
};
type ImportacaoExcel = {
    estado?: "em-andamento" | "concluida";
    regras?: RegrasOS;
    versaoRegras?: string;
    documento?: string;
    resultado: { importadas: number; ignoradas: number; hash: string; pendentes?: number };
};
type Regra = {
    tipo: "regra";
    clienteId: string;
    regras: RegrasOS;
    preferencias?: PreferenciasCobrancaOS;
    versao: string;
    por: string;
    em: string;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const uuid = (v: unknown) => { if (typeof v !== "string" || !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(v) || !/^[a-f0-9-]+$/i.test(v))
    throw Error("Identificador inválido."); return v; };
const conflito = (s: string) => Object.assign(new Error(s), { statusCode: 409 });
export class OrdensServicoStore {
    readonly part: string;
    private cred = new DefaultAzureCredential();
    constructor(readonly empresa: Empresa, private conta = process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "")) { if (!conta)
        throw Error("Armazenamento não configurado."); this.part = `os-${empresa}`; }
    tabela(nome = "AdminDocumentos") { return new TableClient(`https://${this.conta}.table.core.windows.net`, nome, this.cred); }
    container() { return new BlobServiceClient(`https://${this.conta}.blob.core.windows.net`, this.cred).getContainerClient("admin-anexos"); }
    async ler(key: string) { try {
        return await this.tabela().getEntity<{
            json: string;
        }>(this.part, key) as Registro;
    }
    catch (e) {
        if ((e as {
            statusCode?: number;
        }).statusCode === 404)
            return null;
        throw e;
    } }
    async listar() { const regras: Regra[] = [], ordens: Salva[] = [], lotes: LoteOS[] = []; for await (const r of this.tabela().listEntities<{
        json: string;
    }>({ queryOptions: { filter: `PartitionKey eq '${this.part}'` } })) {
        if (r.rowKey?.startsWith("regra-"))
            regras.push(JSON.parse(r.json));
        else if (r.rowKey?.startsWith("os-"))
            ordens.push(JSON.parse(r.json));
        else if (r.rowKey?.startsWith("lote-"))
            lotes.push(JSON.parse(r.json));
    } return { regras, ordens: ordens.sort((a, b) => (b.data + b.inicio).localeCompare(a.data + a.inicio)), lotes }; }
    async cliente(id: unknown) { const key = textoOS(id, 100); if (!/^[a-zA-Z0-9-]+$/.test(key))
        throw Error("Cliente inválido."); const c = await this.tabela(process.env.ADMIN_STORAGE_TABLE_CLIENTES || "AdminClientes").getEntity<{
        nome: string;
        documento: string;
        email: string;
    }>(this.empresa, key); if (!/^\d{11}(\d{3})?$/.test(c.documento.replace(/\D/g, "")))
        throw Error("Documento do cliente inválido."); return { id: key, nome: c.nome, documento: c.documento, email: c.email }; }
    entidade(key: string, json: unknown) { return { partitionKey: this.part, rowKey: key, json: JSON.stringify(json) }; }
    async salvarRegras(clienteId: unknown, regras: unknown, versao: unknown, op: string, por: string, preferencias?: unknown) {
        const c = await this.cliente(clienteId), r = validarRegrasOS(regras), key = `regra-${c.id}`, old = await this.ler(key);
        const anterior = old ? JSON.parse(old.json) as Regra : null;
        let padroes = anterior?.preferencias;
        if (preferencias !== undefined) {
            if (!preferencias || typeof preferencias !== "object" || Array.isArray(preferencias)) throw Error("Preferências inválidas.");
            const p = preferencias as Record<string, unknown>;
            const campo = (nome: string, max: number) => { const v=p[nome]; if(typeof v!=="string" || v.length>max || /[\r\n]/.test(v)) throw Error("Dados de cobrança inválidos."); return v.trim(); };
            padroes = {email:campo("email",254),cc:campo("cc",2540),pixChave:campo("pixChave",150),pixBeneficiario:campo("pixBeneficiario",150)};
            if (padroes.email && !/^[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+$/.test(padroes.email)) throw Error("E-mail de cobrança inválido.");
            if (padroes.cc && !emailsValidos(padroes.cc)) throw Error("E-mails de cópia inválidos.");
        }
        if (anterior?.versao === op) {
            if (JSON.stringify(anterior.regras) !== JSON.stringify(r) || JSON.stringify(anterior.preferencias) !== JSON.stringify(padroes))
                throw conflito("Operação repetida com dados diferentes.");
            return anterior;
        }
        if (anterior && anterior.versao !== versao)
            throw conflito("As regras mudaram. Atualize antes de salvar.");
        const nova: Regra = { tipo: "regra", clienteId: c.id, regras: r, ...(padroes ? {preferencias:padroes} : {}), versao: op, por, em: new Date().toISOString() };
        if (old)
            await this.tabela().updateEntity(this.entidade(key, nova), "Replace", { etag: old.etag });
        else
            await this.tabela().createEntity(this.entidade(key, nova));
        return nova;
    }
    fingerprint(o: Pick<OrdemServico, "clienteId" | "data" | "inicio" | "diaFim" | "fim" | "descricao" | "tipo">) { return `dedup-${hash(JSON.stringify([o.clienteId, o.data, o.inicio, o.diaFim, o.fim, o.tipo, o.descricao]))}`; }
    async salvar(raw: Record<string, unknown>, op: string, por: string) {
        const id = uuid(raw.id), entrada = validarEntradaOS(raw.entrada), c = await this.cliente(raw.clienteId), key = `os-${id}`, old = await this.ler(key), anterior = old ? JSON.parse(old.json) as Salva : null;
        if (anterior?.versao === op) {
            if (JSON.stringify(validarEntradaOS(anterior)) !== JSON.stringify(entrada) || anterior.clienteId !== c.id)
                throw conflito("Operação repetida com dados diferentes.");
            return anterior;
        }
        if (anterior && (anterior.estado !== "aberta" || anterior.versao !== raw.versao || anterior.clienteId !== c.id))
            throw conflito("Atendimento alterado ou bloqueado para edição.");
        const regra = await this.ler(`regra-${c.id}`);
        if (!regra)
            throw Error("Configure e salve as regras do cliente antes de lançar.");
        const regras = anterior?.regras || JSON.parse(regra.json).regras;
        calcularOS(entrada, regras);
        const em = new Date().toISOString();
        const nova: Salva = { ...entrada, id, clienteId: c.id, clienteNome: c.nome, documento: c.documento, regras, estado: "aberta", criadoEm: anterior?.criadoEm || em, atualizadoEm: em, por, versao: op };
        const novaChave = this.fingerprint(nova), antigaChave = anterior ? this.fingerprint(anterior) : null;
        const a: TransactionAction[] = [];
        if (novaChave !== antigaChave)
            a.push(["create", this.entidade(novaChave, { ordemId: id })]);
        if (antigaChave && antigaChave !== novaChave) {
            const index = await this.ler(antigaChave);
            if (index)
                a.push(["delete", { partitionKey: this.part, rowKey: antigaChave }]);
        }
        a.push(old ? ["update", this.entidade(key, nova), "Replace", { etag: old.etag }] : ["create", this.entidade(key, nova)]);
        await this.tabela().submitTransaction(a);
        return nova;
    }
    async preverExcel(clienteId: unknown, bytes: Buffer) {
        const arquivo=lerExcelOS(bytes),c=await this.cliente(clienteId),reg=await this.ler(`regra-${c.id}`);
        if(!reg)throw Error("Salve as regras do cliente antes de importar.");
        const andamento=await this.ler(`excel-${hash(c.id+":"+arquivo.hash)}`),importacao=andamento?JSON.parse(andamento.json) as ImportacaoExcel:null;
        const retomada=importacao?.estado==="em-andamento",atual=JSON.parse(reg.json) as Regra;
        const regra=retomada&&importacao.regras&&importacao.versaoRegras?{regras:validarRegrasOS(importacao.regras),versao:importacao.versaoRegras}:atual;
        const existentes=(await this.listar()).ordens.filter(o=>o.clienteId===c.id),porIdentidade=new Map(existentes.map(o=>[this.fingerprint(o),o])),horariosExistentes=new Set(existentes.map(o=>JSON.stringify([o.data,o.diaFim,o.inicio,o.fim]))),vistas=new Set<string>(),horariosVistos=new Set<string>();
        const linhas=arquivo.linhas.map(l=>{
            if(!l.entrada)return {...l,situacao:"erro" as const};
            const e=l.entrada,fp=this.fingerprint({...e,clienteId:c.id});
            const horario=JSON.stringify([e.data,e.diaFim,e.inicio,e.fim]);
            const igual=porIdentidade.get(fp),mesmoHorario=horariosVistos.has(horario)||horariosExistentes.has(horario);
            horariosVistos.add(horario);
            const duplicada=vistas.has(fp);vistas.add(fp);
            try{const calculo=calcularOS(e,regra.regras);
                return {...l,centavos:calculo.centavos,situacao:igual||duplicada?"repetida" as const:mesmoHorario?"conferir" as const:"nova" as const,observacao:igual?`Já cadastrada${igual.nota?` · NFS-e ${igual.nota}`:""}; não será importada novamente.`:duplicada?"Linha repetida neste arquivo; será ignorada.":mesmoHorario?"Mesmo dia e horário de outro atendimento no arquivo ou cadastro; será ignorada para evitar duplicidade. Confira manualmente.":l.valorPlanilha!==undefined&&l.valorPlanilha!==calculo.centavos?"Valor diferente do Excel. Será usada a regra atual do cliente.":""};
            }catch(e){return {...l,situacao:"erro" as const,erro:e instanceof Error?e.message:"Cálculo inválido."};}
        });
        const novas=linhas.filter(l=>l.situacao==="nova"&&l.entrada).map(l=>({...l.entrada!,id:String(l.linha),clienteId:c.id,clienteNome:c.nome,documento:c.documento,regras:regra.regras,estado:"aberta" as const,criadoEm:"",atualizadoEm:"",por:""}));
        return {hash:arquivo.hash,clienteId:c.id,clienteNome:c.nome,versao:regra.versao,regras:regra.regras,linhas,novas:novas.length,ignoradas:linhas.filter(l=>l.situacao==="repetida"||l.situacao==="conferir").length,erros:linhas.filter(l=>l.situacao==="erro").length,resumo:novas.length?resumirOS(novas,MAX_ATENDIMENTOS_EXCEL_OS):null,retomada,jaImportadas:retomada?importacao.resultado.importadas:0};
    }
    async importarExcel(clienteId:unknown,bytes:Buffer,versao:unknown,op:string,por:string,confirmado:unknown) {
        uuid(op);if(confirmado!==true)throw Error("Confirme a prévia antes de importar.");
        const previa=await this.preverExcel(clienteId,bytes),key=`excel-${hash(previa.clienteId+":"+previa.hash)}`,old=await this.ler(key);
        const anterior=old?JSON.parse(old.json) as ImportacaoExcel:null;
        if(anterior&&anterior.estado!=="em-andamento")return {...anterior.resultado,pendentes:0,repetida:true};
        if(previa.erros)throw Error("Corrija as linhas com erro antes de importar o arquivo inteiro.");
        if(previa.versao!==versao)throw conflito("As regras mudaram depois da prévia. Confira novamente.");
        const c=await this.cliente(previa.clienteId),reg=await this.ler(`regra-${c.id}`);
        if(!reg||(!anterior&&JSON.parse(reg.json).versao!==versao)|| (anterior?.documento&&anterior.documento!==c.documento))throw conflito("Cadastro ou regras alterados. Confira novamente.");
        if(anterior&&JSON.stringify(anterior.regras)!==JSON.stringify(previa.regras))throw conflito("Importação em andamento. Atualize a prévia antes de retomar.");
        const em=new Date().toISOString(),a:TransactionAction[]=[["update",{partitionKey:this.part,rowKey:`regra-${c.id}`,json:reg.json},"Replace",{etag:reg.etag}]];
        const lote=previa.linhas.filter(l=>l.situacao==="nova").slice(0,MAX_NOVOS_LOTE_EXCEL_OS);
        for(const l of lote){
            const h=hash(`${c.id}:${previa.hash}:${l.linha}`),id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
            const o:Salva={...l.entrada!,id,clienteId:c.id,clienteNome:c.nome,documento:c.documento,regras:previa.regras,estado:"aberta",versao:op,criadoEm:em,atualizadoEm:em,por,origem:`Excel OSS · SHA256 ${previa.hash} · linha ${l.linha}`};
            a.push(["create",this.entidade(`os-${id}`,o)],["create",this.entidade(this.fingerprint(o),{ordemId:id})]);
        }
        const importadas=(anterior?.resultado.importadas||0)+lote.length,pendentes=previa.novas-lote.length;
        const resultado={importadas,ignoradas:previa.linhas.length-importadas-pendentes,hash:previa.hash,pendentes};
        const registro=this.entidade(key,{tipo:"importacao-excel",estado:pendentes?"em-andamento":"concluida",hash:previa.hash,clienteId:c.id,documento:c.documento,regras:previa.regras,versaoRegras:previa.versao,resultado,operacaoId:op,por,em});
        a.push(old?["update",registro,"Replace",{etag:old.etag}]:["create",registro]);
        await this.tabela().submitTransaction(a);return {...resultado,repetida:false};
    }
    async cancelar(id: unknown, versao: unknown, op: string, por: string) { const key = `os-${uuid(id)}`, row = await this.ler(key); if (!row)
        throw Error("Atendimento não encontrado."); const o = JSON.parse(row.json) as Salva; if (o.versao === op && o.estado === "cancelada")
        return o; if (o.estado !== "aberta" || o.versao !== versao)
        throw conflito("Somente atendimento aberto e atualizado pode ser cancelado."); o.estado = "cancelada"; o.versao = op; o.por = por; o.atualizadoEm = new Date().toISOString(); await this.tabela().updateEntity(this.entidade(key, o), "Replace", { etag: row.etag }); return o; }
    async selecionadas(ids: string[]) { if (!ids.length || ids.length > 40 || new Set(ids).size !== ids.length)
        throw Error("Selecione de 1 a 40 atendimentos, sem repetições."); const rows = await Promise.all(ids.map(id => this.ler(`os-${uuid(id)}`))); if (rows.some(r => !r))
        throw Error("Atendimento não encontrado nesta empresa."); return rows as Registro[]; }
    async relatorio(ids: string[]) { const rows = await this.selecionadas(ids), ordens = rows.map(r => JSON.parse(r.json) as Salva); if (ordens.some(o => o.estado === "cancelada"))
        throw Error("Atendimento cancelado não entra no relatório."); return pdfOrdensServico(ordens, this.empresa); }
    async cobrar(raw: Record<string, unknown>, op: string, por: string) {
        if (raw.confirmado !== true)
            throw Error("Confirme a preparação da cobrança.");
        const itens = raw.itens as {
            id: string;
            versao: string;
        }[];
        if (!Array.isArray(itens) || !itens.length || itens.length > 40)
            throw Error("Seleção inválida.");
        itens.forEach(i => { uuid(i.id); uuid(i.versao); });
        if (new Set(itens.map(i => i.id)).size !== itens.length)
            throw Error("Seleção repetida.");
        const competencia = textoOS(raw.competencia, 7);
        if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia) || !dataOS(raw.vencimento))
            throw Error("Confira competência e vencimento.");
        const email = textoOS(raw.email, 254);
        if (!/^[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+$/.test(email))
            throw Error("Informe um e-mail válido.");
        const cc = typeof raw.cc === "string" ? raw.cc.trim() : "";
        if (cc && (cc.length > 2540 || !emailsValidos(cc)))
            throw Error("Confira os destinatários em cópia.");
        if (raw.formaPagamento !== "pix" && raw.formaPagamento !== "boleto")
            throw Error("Forma de pagamento inválida.");
        const pixChave = raw.formaPagamento === "pix" ? textoOS(raw.pixChave, 150) : "", pixBeneficiario = raw.formaPagamento === "pix" ? textoOS(raw.pixBeneficiario, 150) : "";
        const assinatura = hash(JSON.stringify({ itens: [...itens].sort((a, b) => a.id.localeCompare(b.id)), competencia, vencimento: raw.vencimento, email, cc, formaPagamento: raw.formaPagamento, pixChave, pixBeneficiario }));
        const key = `lote-${op}`;
        let existente = await this.ler(key), lote: LoteOS;
        if (existente) {
            lote = JSON.parse(existente.json);
            if (lote.hash !== assinatura)
                throw conflito("A operação já existe com outro conteúdo. Retome o lote original.");
        }
        else {
            const rows = await this.selecionadas(itens.map(i => i.id)), os = rows.map(r => JSON.parse(r.json) as Salva);
            selecionarParaCobrancaOS(os, itens.map(i => i.id));
            if (os.some(o => o.versao !== itens.find(i => i.id === o.id)?.versao))
                throw conflito("Atendimento mudou. Atualize a seleção.");
            const planoId = hash(`os:${this.empresa}:${op}`), em = new Date().toISOString();
            lote = { id: op, tipo: "lote", estado: "reservado", ids: itens.map(i => i.id), clienteId: os[0].clienteId, competencia, vencimento: raw.vencimento, email, cc, formaPagamento: raw.formaPagamento, pixChave, pixBeneficiario, planoId, cobrancaId: `${planoId}_${competencia}`, emailId: op, criadoEm: em, por, hash: assinatura };
            await this.tabela().submitTransaction([["create", this.entidade(key, lote)], ...rows.map((r, i): TransactionAction => ["update", this.entidade(r.rowKey, { ...os[i], estado: "reservada", loteId: op, atualizadoEm: em }), "Replace", { etag: r.etag }])]);
            existente = await this.ler(key);
        }
        if (lote.estado === "concluido")
            return lote;
        await this.concluirLote(lote);
        return { ...lote, estado: "concluido" };
    }
    async garantir(table: TableClient, part: string, id: string, obj: unknown) { const data = JSON.stringify(obj); try {
        await table.createEntity({ partitionKey: part, rowKey: id, json: data });
    }
    catch (e) {
        if ((e as {
            statusCode?: number;
        }).statusCode !== 409)
            throw e;
        const old = await table.getEntity<{
            json: string;
        }>(part, id);
        if (old.json !== data)
            throw conflito("O registro de destino já existe com dados diferentes. Confira antes de continuar.");
    } }
    async concluirLote(lote: LoteOS) {
        const rows = await this.selecionadas(lote.ids), ordens = rows.map(r => JSON.parse(r.json) as Salva);
        if (ordens.some(o => o.estado !== "reservada" || o.loteId !== lote.id))
            throw conflito("A reserva do lote não corresponde aos atendimentos.");
        const resumo = resumirOS(ordens), c = await this.cliente(lote.clienteId);
        const descricao = `Serviços prestados de ${[...ordens].sort((a, b) => a.data.localeCompare(b.data))[0].data} a ${[...ordens].sort((a, b) => b.diaFim.localeCompare(a.diaFim))[0].diaFim}. ${ordens.length} atendimento(s).`;
        const plano: Plano = { id: lote.planoId, avulsa: true, clienteId: c.id, clienteNome: ordens[0].clienteNome, documento: ordens[0].documento, email: lote.email, descricao, centavos: resumo.total, inicio: lote.competencia, fim: lote.competencia, diaEnvio: 1, mesEnvio: 0, diaVencimento: Number(lote.vencimento.slice(8)), mesVencimento: 0, criadoEm: lote.criadoEm };
        const cobranca: Cobranca = { id: lote.cobrancaId, planoId: lote.planoId, competencia: lote.competencia, clienteNome: plano.clienteNome, email: lote.email, descricao, centavos: resumo.total, envioPrevisto: lote.criadoEm.slice(0, 10), vencimento: lote.vencimento, nota: "", boleto: "", demonstrativo: false, eventos: [], persistida: true };
        const blob = `os/${this.empresa}/${lote.id}.pdf`, bytes = await pdfOrdensServico(ordens, this.empresa), container = this.container();
        try {
            await container.getBlockBlobClient(blob).uploadData(bytes, { conditions: { ifNoneMatch: "*" }, blobHTTPHeaders: { blobContentType: "application/pdf" } });
        }
        catch (e) {
            if (![409, 412].includes((e as {
                statusCode: number;
            }).statusCode))
                throw e;
        }
        const email: EmailCobranca = { ...novoEmail(this.empresa, plano.clienteNome), id: lote.emailId, para: lote.email, responderPara: this.empresa === "sysney" ? "financeiro@sysney.com" : "financeiro@drsoftinformatica.com", descricao, introducao: "Segue o demonstrativo dos serviços prestados e o relatório para conferência.", competencia: lote.competencia, vencimento: lote.vencimento, centavos: resumo.total, formaPagamento: lote.formaPagamento, pixChave: lote.pixChave, pixBeneficiario: lote.pixBeneficiario, observacoes: `Subtotal dos serviços: R$ ${(resumo.subtotal / 100).toFixed(2)}. Acréscimo comercial: ${resumo.adicionalBps / 100}%. Total: R$ ${(resumo.total / 100).toFixed(2)}.`, fluxo: { cobrancaId: lote.cobrancaId, nota: "", boleto: "" }, anexos: [{ tipo: "ordem-servico", nome: "Relatorio-servicos-prestados.pdf", blob, tamanho: (await container.getBlockBlobClient(blob).getProperties()).contentLength || bytes.length }], atualizadoEm: lote.criadoEm };
        email.cc = lote.cc || "";
        await this.garantir(this.tabela(), `emails-${this.empresa}`, email.id, email);
        await this.garantir(this.tabela("AdminConfiguracoes"), `cobrancas-${this.empresa}`, plano.id, plano);
        await this.garantir(this.tabela(), `cobrancas-${this.empresa}`, cobranca.id, cobranca);
        const row = await this.ler(`lote-${lote.id}`);
        if (!row)
            throw Error("Reserva não encontrada.");
        await this.tabela().submitTransaction([["update", this.entidade(row.rowKey, { ...lote, estado: "concluido" }), "Replace", { etag: row.etag }], ...rows.map((r, i): TransactionAction => ["update", this.entidade(r.rowKey, { ...ordens[i], estado: "cobrada", cobrancaId: lote.cobrancaId, atualizadoEm: lote.criadoEm }), "Replace", { etag: r.etag }])]);
    }
    async importarHistorico(ordens: Salva[], nota: string, fonte: string, por: string) {
        if (!/^\d+$/.test(nota) || !ordens.length || ordens.length > 40 || ordens.some(o => o.estado !== "historico" || o.nota !== nota))
            throw Error("Importação histórica inválida.");
        const cliente = await this.cliente(ordens[0].clienteId);
        if (ordens.some(o => o.documento !== cliente.documento || o.clienteId !== cliente.id))
            throw Error("Cliente divergente do histórico.");
        const resumo = resumirOS(ordens), key = `importacao-${hash(`${cliente.documento}:${nota}`)}`, assinatura = hash(JSON.stringify({ ordens, fonte }));
        const old = await this.ler(key);
        if (old) {
            if (JSON.parse(old.json).hash !== assinatura)
                throw conflito("A nota já tem importação histórica diferente.");
            return { importada: false, total: resumo.total };
        }
        const a: TransactionAction[] = [];
        for (const o of ordens) {
            uuid(o.id);
            calcularOS(o, o.regras);
            a.push(["create", this.entidade(`os-${o.id}`, o)], ["create", this.entidade(this.fingerprint(o), { ordemId: o.id })]);
        }
        if (!await this.ler(`regra-${cliente.id}`))
            a.push(["create", this.entidade(`regra-${cliente.id}`, { tipo: "regra", clienteId: cliente.id, regras: ordens[0].regras, versao: ordens[0].versao, por, em: ordens[0].criadoEm })]);
        a.push(["create", this.entidade(key, { tipo: "importacao", nota, documento: cliente.documento, hash: assinatura, fonte, ids: ordens.map(o => o.id), total: resumo.total, por, em: ordens[0].criadoEm })]);
        await this.tabela().submitTransaction(a);
        return { importada: true, total: resumo.total };
    }
    async executar(body: Record<string, unknown>, por: string) { const op = uuid(body.operacaoId); if (body.acao === "regras")
        return this.salvarRegras(body.clienteId, body.regras, body.versao, op, por, body.preferencias); if (body.acao === "salvar")
        return this.salvar(body, op, por); if (body.acao === "cancelar")
        return this.cancelar(body.id, body.versao, op, por); if (body.acao === "cobrar")
        return this.cobrar(body, op, por); if (body.acao === "retomar") {
        if (body.confirmado !== true)
            throw Error("Confirme a retomada do lote.");
        const row = await this.ler(`lote-${uuid(body.id)}`);
        if (!row)
            throw Error("Lote não encontrado.");
        const lote = JSON.parse(row.json) as LoteOS;
        if (lote.estado !== "concluido")
            await this.concluirLote(lote);
        return { cobrancaId: lote.cobrancaId };
    } throw Error("Ação inválida."); }
}
