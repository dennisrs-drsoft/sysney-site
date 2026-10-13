import {dataValida,pago,type Cobranca} from "./cobrancas";
export type FiltrosFila={busca:string;situacao:string;inicio:string;fim:string;data:"vencimento"|"competencia"|"envioPrevisto"};
export function filtrarFila(linhas:Cobranca[],f:FiltrosFila,hoje:string){
 if((f.inicio&&!dataValida(f.inicio))||(f.fim&&!dataValida(f.fim))||(f.inicio&&f.fim&&f.inicio>f.fim))return [];
 const normalizar=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const busca=normalizar(f.busca.trim());
 return linhas.filter(c=>{
  const saldo=Math.max(0,c.centavos-pago(c)),atrasada=saldo>0&&dataValida(c.vencimento)&&c.vencimento<hoje;
  if(f.situacao==="abertas"&&saldo===0||f.situacao==="pagas"&&saldo>0||f.situacao==="atrasadas"&&!atrasada||f.situacao==="parciais"&&!(saldo>0&&pago(c)>0))return false;
  if(busca&&!normalizar(`${c.clienteNome} ${c.descricao} ${c.nota} ${c.boleto} ${c.competencia} ${c.competencia.split("-").reverse().join("/")}`).includes(busca))return false;
  const data=f.data==="competencia"?`${c.competencia}-01`:c[f.data];
  return (!f.inicio&&!f.fim)||(dataValida(data)&&(!f.inicio||data>=f.inicio)&&(!f.fim||data<=f.fim));
 });
}
