import {args} from './atp-municipal-fixture.mjs';
import {buildAtpMunicipal} from '../../admin-api/src/services/atp-municipal-model.mjs';
const input={...args.input,paymentId:'QA-TEST-ONLY-NO-PAYMENT',externalReference:'QA:TESTE-SEM-VALIDADE-FISCAL',orderId:'QA-NO-ORDER',arenaId:'QA-NO-ARENA',amountCentsBRL:100,competence:'2026-10',servicePeriod:{startDate:'2026-10-27',endDate:'2026-10-27'},description:'TESTE SEM VALIDADE FISCAL - ATP - validacao tecnica do metodo testeenvio, sem prestacao, pagamento, cobranca ou emissao real.',recipient:{...args.input.recipient,legalName:'TESTE SEM VALIDADE FISCAL'}};
console.log(JSON.stringify(buildAtpMunicipal({...args,input,series:'TQA27',number:'1'})));
