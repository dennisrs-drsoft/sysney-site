# NFS-e Nacional no administrativo — implantação de 02/11/2026

## Resultado e limites

Implementado o fluxo nacional para SYSNEY e DRSoft: perfil por cliente, prévia,
reserva DPS transacional por emitente/ambiente, assinatura no Windows, aprovação
vinculada à versão, transmissão única, consulta após falhas e recuperação de
XML/DANFSe. O serviço isolado está instalado na DRServer em modo **assinatura e
consultas**, com envio desabilitado. Isso não equivale a homologação oficial nem
a liberação de notas reais. A publicação Next/API e a verificação on-line estão
registradas em [evidência de release](RELEASE-NFSE-NACIONAL-2026-11-02.md).

Os regimes cadastrados foram preservados: SYSNEY Simples Nacional e DRSoft
Lucro Presumido. Não foram emitidas notas, gerados boletos, enviados e-mails ou
alterados pagamentos durante a implantação. SQL, MySQL, firewall, certificados,
serviço municipal e configuração ATP não foram alterados.

## Fluxo e armazenamento

O endpoint existente `nfse` mantém autenticação administrativa, origem/CSRF e
respostas privadas. `GET` nacional é somente leitura; as ações `POST` são:

- `nacional-preparar`: salva perfil e dados atuais da cobrança; não reserva DPS.
- `nacional-assinar`: exige prévia atual, emitente vigente e confirmação de série
  exclusiva; reserva número/atribuição atomicamente e solicita assinatura local.
- `nacional-emitir`: exige assinatura, hash, contexto atual, política fiscal
  protegida, gate do ambiente e aprovação específica; bloqueia a cobrança por
  ETag antes de enfileirar. Produção exige homologação do mesmo perfil com XML e PDF.
- `nacional-resultado`: confere tarefa, tipo, hash, escopo e documentos antes de
  vincular. A homologação fica no arquivo QA e não vira nota de produção.
- `nacional-consultar`: recupera a mesma DPS; nunca transmite outro documento.

Namespaces separados por empresa, CNPJ e ambiente. Perfis ficam em
`AdminConfiguracoes/nfse-nacional-perfis-{empresa}`; prévias em
`AdminDocumentos/nfse-nacional-previas-{empresa}`; trabalhos em
`nfse-nacional-trabalhos-{empresa}`. A sequência usa transação para contador e
atribuição estável; não há reset, TTL ou exclusão que permita reutilizar números.
A fila usa `FiscalFila/nacional-admin-fila-v1`, claim por ETag, expiração antes de
execução e resultados particionados em chunks com hash/tamanho.

O worker lê trabalhos e aprovação da tabela privada, sem receber certificado
ou credenciais do navegador. O transporte nativo relê aprovação e cobrança
imediatamente antes do POST e cria um segundo claim durável. Rejeição, timeout,
queda ou resultado inválido nunca apagam claims para permitir novo POST. Uma
falha antes/depois de enfileirar pode exigir conciliação; não há desbloqueio
fiscal automático baseado apenas em ausência de resposta.

Referência comercial, competência fiscal real e emissão atual são distintas.
Datas/códigos não são trocados para superar regras do governo. XML trata escape,
centavos, retenções sobre o valor atual e endereço; séries DPS não usam RPS.
PDF/XML têm armazenamento privado e conteúdo imutável por chave/hash. As telas
de arquivo, acompanhamento e resumo distinguem a chave nacional do número
municipal, inclusive quando os números coincidem. Nenhum documento é enviado
por e-mail sem a revisão/aprovação já existente.

## Serviço Windows

Pasta `C:\ProgramData\SYSNEY\NfseNacional`; tarefa
`SYSNEY-NFS-e-Nacional-Isolado`, SYSTEM, uma vez por minuto, sem execuções
sobrepostas. Reutiliza o runtime Node já conferido, sem reinstalá-lo ou mudar
sua configuração. Manifesto verifica SHA-256 do runner, scripts e XSD; ACL fica
restrita a SYSTEM/Administradores. Certificados continuam no repositório
LocalMachine, usando os vínculos já existentes do serviço fiscal. Nenhuma chave
privada foi exportada. As permissões existentes da identidade gerenciada foram
reutilizadas; não houve concessão nova de acesso.

Configuração inicial: `paused=false`, `allowSigning=true`, `allowQueries=true`,
`allowSend=false`, políticas de envio vazias. O gate de produção da API permanece
desabilitado por padrão. Liberar transmissão exige revisão própria de política
por emitente/ambiente/perfil, tanto na API quanto na VM. A autorização do usuário
para implantação não foi interpretada como aprovação de uma nota específica.

Instalador usa TLS 1.2 somente no processo e grava JSON UTF-8 sem BOM; o runner
também tolera BOM inicial para compatibilidade com PowerShell 5. Não muda TLS,
DNS, firewall ou configurações globais do Windows.

## Pendências fiscais e de homologação

1. Código municipal 03158 é um agrupamento do item 17.02. A lista nacional separa
   atividades desse item; não existe autorização para substituir esse código por
   licenciamento/suporte apenas pela descrição comercial. A correspondência de
   destino precisa ser conferida com a classificação já adotada pela contabilidade.
   Não se alterou CNAE, regime ou notas anteriores. Outras correspondências só
   podem ser preenchidas quando inequívocas e sustentadas por fonte oficial.
2. Conferir dados nacionais exigidos: enquadramento, apuração, ISS, retenções,
   transparência e NBS quando aplicável. Validar habilitação específica da DRSoft
   no nacional; Lucro Presumido não recebe automaticamente a regra do Simples.
3. Executar teste oficial com perfil real aprovado e conferir retorno, XML,
   cadeia de confiança e DANFSe de cada emitente. Testes locais/simulações não
   demonstram aceite do governo. Não foi transmitido documento de homologação
   oficial nesta implantação.
4. Só depois habilitar políticas de transmissão e produção correspondentes.
   Atualização de cancelamento/substituição nacional exige fonte oficial própria;
   recuperar o XML original não comprova ausência de eventos fiscais posteriores.
   A situação original arquivada não é certidão de situação fiscal atual.
5. Certificado SYSNEY verificado com validade até 10/11/2026 (UTC); DRSoft até
   05/03/2027. Renovação não foi realizada e deve ser acompanhada antes de vencer.

A orientação oficial de 29/10/2026 usa **competência fiscal**, não emissão,
como critério: Simples em São Paulo até 31/10/2026 permanece municipal; desde
01/11/2026 segue nacional. Não houve mudança artificial de datas.

Fontes consultadas em 02/11/2026:

- https://www.gov.br/nfse/pt-br/noticias/nfs-e-informa-diretrizes-sobre-a-obrigatoriedade-da-emissao-da-nfs-e-nacional-para-optantes-do-simples-nacional/
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
- https://www.gov.br/nfse/pt-br/mei-e-demais-empresas/codigos-de-tributacao-nacional-nbs
- https://prefeitura.sp.gov.br/documents/d/fazenda/in_sf-surem_08_2011_anexo_1_atualiz_at_in_06-2024_1712582812_formatado-pdf

## Validação

254 testes Node aprovados, zero falhas/ignorados, com SDK Azure contra Azurite e
SEFIN simulada pelo Postman local. Casos novos: dois emitentes/ambientes,
concorrência e perda de resposta na reserva, chunks corrompidos, política
bloqueada, aprovação vencida, cobrança alterada, timeout após commit, recuperação
sem novo POST, PDF vinculado e notas municipais/nacionais de mesmo número.

TypeScript, ESLint, build Next.js, compilação da API e runner aprovados. Testes
nativos usaram certificado efêmero em memória, ambos os pacotes XSD oficiais,
assinatura, adulteração e isolamento. Nenhuma instalação/exportação de
certificado ou chamada fiscal oficial nos testes. O último reforço de conferência
do CNPJ vigente também passou nos testes específicos do runtime.

A recuperação de perfis do commit dfd0b66 foi preservada. Consulta privada aos
rascunhos/planos atuais identificou um cliente SYSNEY sem nota no recorte; seu
perfil já existia e foi mantido. Isso não comprova inexistência de pendências
fora do recorte. Evidências com documentos, configurações, SAS e scripts
operacionais ficam em output privado, fora do Git.
