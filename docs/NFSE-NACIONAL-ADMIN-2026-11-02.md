# Preparação nacional no administrativo — 02/11/2026

## Situação e limite da entrega

Implementada a preparação de perfil e prévia nacional por cobrança, para SYSNEY
e DRSoft, reutilizando a autenticação e a proteção de origem do endpoint `nfse`.
**Não é uma integração de transmissão concluída.** Não foi publicada e nenhum
documento real foi emitido nos testes. Não ativar um botão de emissão apenas
porque o XML passa no XSD.

O trabalho anterior de recuperação dos perfis municipais está no commit
`dfd0b66`. Esta continuação preserva a tela de diagnóstico, os identificadores DPS
e os bloqueios nacionais existentes, acrescentando preparação utilizável no
editor da cobrança. Não muda o regime das empresas.

## Comportamento implementado

- `GET /api/admin/nfse?empresa=...&id=...&emissor=nacional` consulta perfil e prévia
  privados da empresa e do cliente, sem reservar numeração ou emitir.
- `POST` no mesmo endpoint, ação `nacional-preparar`, exige confirmação, versão
  atual da cobrança e ausência de nota/anexo/operação municipal. Identidade do
  emitente, regime vigente, tomador, descrição e valor vêm do servidor.
- Perfil nacional em `AdminConfiguracoes/nfse-nacional-perfis-{empresa}/{CNPJ}`;
  prévia em `AdminDocumentos/nfse-nacional-previas-{empresa}/{idFiscal}`. Escritas
  existentes usam ETag. Não copiar aprovação, contador, data ou imposto monetário
  de uma nota anterior. Uma falha na gravação do perfil não autoriza transmissão
  e a prévia permanece consultável.
- Referência comercial mensal, data real da competência fiscal e data atual de
  emissão são campos distintos. Não inferir data fiscal da data de pagamento.
- O formulário recupera endereço do perfil municipal previamente validado, mas
  não converte automaticamente código municipal em nacional. Código municipal
  antigo de cinco dígitos não cabe no complemento municipal nacional de três.
- Gerador DPS isolado por emitente e ambiente, com escape XML, dados obrigatórios,
  retenções federais recalculadas sobre o valor atual no perfil Presumido e série
  independente de RPS. Não reserva DPS e não chama governo.
- Assinador nativo apenas local, sem rede, com identidade/ambiente esperados,
  assinatura conferida, IDs únicos, XML sem DTD e validação pelo XSD do ambiente.
  O certificado deve ser vinculado pelo futuro chamador à configuração protegida
  do emitente. Esta biblioteca não substitui autorização e vinculação do certificado.
- Pacotes oficiais de produção e homologação permanecem separados. Produção
  não aceita `finNFSe` na mesma posição da revisão restrita. O XSD oficial de
  assinatura de produção contém DOCTYPE; o leitor ignora essa declaração somente
  no esquema local, sem resolver DTD externa. XML de documentos continua proibindo DTD.

## Regra de transição confirmada

A orientação oficial de 29/10/2026 define a **competência fiscal** como critério,
não a data de emissão. Simples Nacional de São Paulo, competência até 31/10/2026:
emissão municipal retroativa; competência desde 01/11/2026: nacional. Não mudar
datas para superar a trava. A DRSoft está configurada como Lucro Presumido e sua
habilitação nacional exige confirmação própria.

Fontes oficiais consultadas em 02/11/2026:

- https://www.gov.br/nfse/pt-br/noticias/nfs-e-informa-diretrizes-sobre-a-obrigatoriedade-da-emissao-da-nfs-e-nacional-para-optantes-do-simples-nacional/
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
- https://www.gov.br/nfse/pt-br/mei-e-demais-empresas/codigos-de-tributacao-nacional-nbs

## O que ainda falta para emissão real

1. Conferir a classificação nacional dos serviços com o usuário, apuração,
   transparência, retenções e elegibilidade de cada emitente/competência.
2. Implementar o ciclo completo de transmissão do painel ao serviço fiscal
   isolado na VM: aprovação vinculada ao hash/versão, reserva DPS transacional
   por empresa/ambiente, assinatura com certificado protegido, claim durável
   antes do POST e consulta após qualquer resultado incerto, sem retransmitir.
3. Conferir XML autorizado, assinatura oficial, identidade, competência, valor,
   situação e DANFSe antes de anexar e vincular à cobrança. A biblioteca nacional
   restrita existente é exclusiva de homologação ATP; não habilitá-la como se
   fosse automaticamente a integração administrativa de produção.
4. Homologar com perfis reais aprovados, preservar evidências privadas e só então
   liberar produção por empresa. Testes sintéticos locais não equivalem a esse
   aceite. Nenhum teste oficial que crie documento foi executado nesta entrega.
5. Publicar componentes necessários após autorização específica. Nenhum gate,
   certificado, serviço da VM, regra de rede, SQL ou MySQL foi alterado aqui.

## Conferência operacional dos perfis pendentes

Consulta privada aos rascunhos e aos planos atuais em 02/11 identificou um cliente
SYSNEY sem nota no conjunto consultado; o perfil municipal já existia e foi
preservado. Nenhum outro perfil precisou ser criado nessa consulta. Isso não
prova ausência de pendências fora desse recorte ou no emissor externo. A rota de
fallback do commit anterior atende as próximas cobranças ao consultar o XML
oficial do mesmo tomador e emitente, respeitando o perfil explícito existente.

Nenhuma nota, boleto, baixa bancária, mensagem, sequência ou perfil preexistente
foi alterado pela conferência. Relatórios com documentos de clientes ficam fora
do Git.

## Validação

- 245 testes Node aprovados, zero falhas e zero testes ignorados, com Azure SDK
  contra Azurite isolado e os cenários HTTP nacionais existentes contra a
  simulação Postman local. Nenhum endpoint fiscal real foi usado nos testes.
- TypeScript, ESLint dos arquivos alterados, build Next.js e compilação da API
  administrativa aprovados na cópia física de QA.
- Assinatura nativa com chave/certificado efêmeros em memória: dois emitentes
  sintéticos, ambos os ambientes, XSD específico, identidade divergente e
  adulteração. Nenhum certificado foi instalado ou exportado.
- Os testes de preparação verificam autenticação, origem, versão antiga,
  identidade/valor vindos do servidor, nota existente e trabalho municipal;
  confirmam ausência de reserva DPS, emissão, alteração do e-mail e envio.
