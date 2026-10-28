import {saoPauloFiscalDate} from './atp-municipal-workflow.mjs';
const fail=code=>{throw Error(code);};
export function inspectIssuanceWindow({input,config,nowUtc}){
 const w=input.issuanceWindow,now=Date.parse(nowUtc);
 if(!Number.isFinite(now))fail('ATP_WINDOW_CLOCK_REVIEW_REQUIRED');
 if(!w){if(config.mode!=='simulation'||config.issuanceWindowPolicyVersion)fail('ATP_WINDOW_MISSING_REVIEW_REQUIRED');return {state:'ready',emissionDate:saoPauloFiscalDate(nowUtc)};}
 const start=Date.parse(w.notBeforeUtc),deadline=Date.parse(w.fiscalDeadlineUtc),verified=Date.parse(input.paymentVerifiedAtUtc);
 const delay=start-verified;
 if(!Number.isFinite(start)||!Number.isFinite(deadline)||delay<=0||delay>86400000||config.issuanceWindowPolicyVersion&&w.policyVersion!==config.issuanceWindowPolicyVersion)fail('ATP_WINDOW_POLICY_REVIEW_REQUIRED');
 if(w.policyVersion==='ATP-WAIT-v1'&&delay!==86400000)fail('ATP_WINDOW_POLICY_REVIEW_REQUIRED');
 if(start>deadline||now>deadline)fail('ATP_WINDOW_DEADLINE_REVIEW_REQUIRED');
 const planned=saoPauloFiscalDate(w.notBeforeUtc),civil=saoPauloFiscalDate(nowUtc),routing=config.municipalRouting;
 if(planned.slice(0,7)!==input.competence||now>=start&&civil.slice(0,7)!==input.competence)fail('ATP_WINDOW_COMPETENCE_REVIEW_REQUIRED');
 if(routing&&(planned<routing.validFromDate||planned>routing.validThroughDate||now>=start&&(civil<routing.validFromDate||civil>routing.validThroughDate)))fail('ATP_WINDOW_ROUTING_REVIEW_REQUIRED');
 return {state:now<start?'waiting':'ready',notBeforeUtc:w.notBeforeUtc,fiscalDeadlineUtc:w.fiscalDeadlineUtc,windowPolicyVersion:w.policyVersion,...(now>=start?{emissionDate:civil}:{})};
}
