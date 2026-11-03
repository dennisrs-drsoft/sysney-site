# Release NFS-e Nacional — 02/11/2026

## Estado publicado

Preparação, assinatura e consultas disponíveis para SYSNEY e DRSoft em
Documentos → Emissor Nacional. Transmissão real permanece desabilitada na API
e na VM. Não houve emissão fiscal oficial, boleto, envio de mensagem ou alteração
de pagamento nesta implantação. Regimes e classificações existentes preservados.

## Componentes e evidências

- Site Next.js: código `6926174e86c047e4e045de1214a141145cd65298`, workflow
  GitHub Actions `41566813397`, security_checks e Build and Deploy concluídos.
- API financeira `sysney-admin-api-2602`, grupo `sysney`: mesmo código;
  ZIP SHA256 `4860a46ad6b18b31e8acad993c00e70929a18535ba15c797a56d9685590aa4e2`.
  Configuração preservada, exceto marcador de versão. Hash das configurações
  excluindo esse marcador: `9511aa430895bd82789c50c233dc9a5c66bdd55bfae5435aa7a0041dc5ff9d33`.
- VM DRServer, grupo DEVELOPER: serviço isolado em
  `C:\ProgramData\SYSNEY\NfseNacional`, tarefa
  `SYSNEY-NFS-e-Nacional-Isolado`; assinatura e consultas habilitadas, envio
  desabilitado e políticas de emitentes vazias. Fonte nativa `2ad53a6`;
  pacote SHA256 `77aa8481ea99b727ed2636456edbb8aeb55dfffed6f2a185a72d63956814e036`;
  runner SHA256 `a82b0ad49eae534aa6be0cec1d473ec1bf4f6ccf82a8ee25fbbd514ad5b3abe1`.
  Heartbeat conferido atualizado, com assinatura ativa e envio inativo.

SQL, MySQL, firewall e certificados não foram alterados. Configurações do
serviço municipal e ATP preservadas. Evidências operacionais privadas ficam
fora do Git; nenhum segredo, SAS, XML/PDF financeiro ou certificado foi incluído.

## Verificação

254 testes aprovados, zero falhas ou ignorados, na árvore limpa do código
publicado; build normal Next.js/Turbopack, TypeScript, ESLint e compilação da API
aprovados. Testes incluem isolamento por empresa/ambiente, reserva concorrente,
timeout sem retransmissão, filas expiradas, documentos vinculados, assinatura/XSD,
separação municipal/nacional e data brasileira de emissão na virada UTC.
Certificados de teste efêmeros; nenhuma transmissão oficial de homologação.

Auditoria de dependências de produção: zero alertas altos/críticos na raiz e
na API. Corrigido follow-redirects para 1.16.2 e verificada a remoção de cabeçalhos
sensíveis em redirecionamento entre origens. Permanecem alertas baixos/moderados
(raiz: quatro baixos e três moderados; API: três moderados), para manutenção.
Isso não constitui auditoria de segurança completa ou pentest.

Smoke público: home www, contato, página de pequenas marcas, robots e sitemap
HTTP 200; raiz sem www redireciona 301 para www; admin e endpoint administrativo
redirecionam ao login; API externa sem chave retorna 401; app.sisdocs.com responde
200. Consultas autenticadas, somente leitura, do contexto nacional retornaram
200 para ambas as empresas, disponível=true, transmissão=false, produção=false,
SYSNEY Simples e DRSoft Presumido. Não substituem teste de transação fiscal real.

## Pendências para liberar emissão

Conferir a correspondência nacional dos códigos fiscais existentes, sem presumir
que um código municipal agrupado corresponde a uma única atividade nacional;
validar habilitação específica da DRSoft. Executar homologação oficial de cada
emitente e conferir XML/DANFSe antes de habilitar transmissão e produção.
O certificado SYSNEY vence em 10/11/2026 UTC; o DRSoft em 05/03/2027 UTC.
Detalhes e fontes em [documentação da implantação](NFSE-NACIONAL-ADMIN-2026-11-02.md).
