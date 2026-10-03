# Emissão fiscal pela cobrança

## Implementado

O painel oferece preparação municipal para DRSOFT e SYSNEY, teste sem emissão
(`TesteEnvioLoteRPS`), envio individual (`EnvioRPS`) e consulta por chave de RPS
(`ConsultaNFe`). O assinador usa o certificado no repositório Windows do usuário
que executa o painel local, sem exportar a chave privada.

As três mensagens são validadas pelos XSD oficiais correspondentes ao regime
configurado, não ao nome da empresa: Simples usa leiaute 1 (cadeia de 86 posições,
inscrição de 8 dígitos, ValorServicos), Lucro Presumido usa leiaute 2 (90 posições,
inscrição de 12 dígitos, ValorFinalCobrado). Ambos usam RSA/SHA-1 conforme o manual
municipal 3.3.9. Não reutilizar essa assinatura para DPS nacional.

O regime é configurado no painel com vigência e histórico privado em
AdminConfiguracoes/nfse-regimes. Mudanças não alteram notas anteriores. A prévia
congela o regime e os percentuais; mudança de regime vigente invalida a transmissão
de uma prévia antiga. Provas anteriores à atualização do protocolo não são reutilizadas.

Para retenções percentuais, o servidor recalcula cada tributo em centavos sobre
o valor bruto atual. Percentuais editáveis propostos pela planilha do titular:
IRRF 1,5%, CSLL 1%, COFINS 3%, PIS 0,65%. São parâmetros de um cliente/serviço,
não regra universal para todos os contribuintes do Lucro Presumido. Configurações
por cliente ficam em AdminConfiguracoes/nfse-retencoes-<empresa>, nunca no código.
O arredondamento é feito separadamente por tributo. O total da nota e boleto não
é reduzido pelas retenções, conforme instrução expressa do titular (a coluna BOLETO
da planilha faz uma dedução diferente e não é reproduzida como valor da cobrança).
INSS não é inferido; os campos adicionais seguem a conferência fiscal.
No perfil Simples atual, os complementos federais e IBS/CBS não são exigidos na
tela municipal; uma situação excepcional com retenção exige emissão manual e revisão.

A série proposta SB001 e o número inicial 1 **não são ativados automaticamente**.
O administrador confirma o histórico antes da primeira reserva. A sequência usa
controle de concorrência e é segregada por empresa/série. Números reservados não
são reutilizados, inclusive quando a preparação não chega a ser emitida.

Alterações no cliente, PO, descrição, valor, competência, data ou dados fiscais
exigem nova preparação e teste. Uma aprovação de envio do e-mail não aprova uma
emissão fiscal, nem o inverso.

## Homologação obrigatória antes de produção

1. Conferir regime vigente, código municipal, endereço do tomador e, no leiaute 2,
   NBS, indicador de operação, classificação IBS/CBS, tipo de retenção, percentuais
   e ISS. Não deduzir retenções dos valores impressos em uma nota histórica sem
   confirmar seu significado e aplicabilidade ao cliente/serviço.
2. Abrir a cobrança local, preencher os campos e preparar a prévia.
3. Executar o teste na Prefeitura; caso o Windows peça autorização do certificado,
   o titular deve autorizá-lo pessoalmente. Não registrar a senha no sistema.
4. Conferir retorno, alertas e consulta em uma homologação supervisionada.
5. Só então configurar `NFSE_SP_PRODUCAO_HABILITADA=true` no processo local.
   A variável não é habilitada pelos scripts de publicação.
6. A transmissão real exige, ainda, teste aceito nos últimos 30 minutos, dados
   inalterados, data de emissão atual e aprovação explícita no painel.

## Recuperação e bloqueios

Uma trava durável é gravada **antes** da transmissão. Timeout não libera nova
emissão: consultar sempre a mesma chave de RPS. Consulta confirma inscrição,
tomador, valor e descrição antes de vincular a nota à cobrança. Divergências ou
uma tentativa sem resultado exigem conciliação com o portal.

Erros anteriores à transmissão do teste podem ser corrigidos e testados novamente.
Uma transmissão real rejeitada não é repetida automaticamente. Consultar e
conciliar é obrigatório antes de qualquer substituição.

## Limitações explícitas desta etapa

- Escopo municipal: serviço tributado/prestado em São Paulo, tomador CNPJ,
  sem intermediário, sem obra, exportação, imunidade ou exigibilidade suspensa.
  Casos diferentes usam emissão manual.
- O painel on-line pode preparar dados; **não pode usar o certificado deste
  Windows**. Teste/transmissão/consulta acontecem no painel local. Um assinador
  remoto seguro/worker local autenticado ainda precisa ser implementado.
- O XML de retorno fica no registro fiscal privado. Não há download automático
  de PDF nesta etapa: obter o PDF no portal, anexar e revisar antes de aprovar o
  envio. O módulo não apresenta um PDF próprio como documento oficial.
- Emitentes configurados como Simples Nacional: a partir de 01/11/2026, a emissão municipal é bloqueada nesta integração;
  o adaptador nacional e sua habilitação continuam pendentes, sem migração
  automática de códigos, série ou sequência.
- Agendamento automático e envio de e-mail não são executados por este módulo.

## Configuração protegida

O emitente é obtido de `NFSE_<EMPRESA>_CNPJ`/`NFSE_<EMPRESA>_CCM` ou da tabela privada
AdminConfiguracoes, partição `nfse-emitentes`. Nunca do corpo enviado pelo navegador.
Os registros fiscais e sequências estão em AdminDocumentos. Não colocar dados de
clientes, XML reais, senhas ou certificados no repositório público.

## Testes sem efeitos externos

`node --test tests/nfse-sp.test.mjs` verifica geração, XSD oficial offline,
autenticação, origem, numeração, invalidação, aprovação, concorrência e recuperação.
Os dados são sintéticos e o transporte fiscal é simulado. A validação PowerShell
usa `-ValidarSomente`, não acessa certificados e não transmite dados.

Testes locais aprovados não substituem homologação junto à Prefeitura.
