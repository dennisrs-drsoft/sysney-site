import {app} from '@azure/functions';
import {runAzureAtpMunicipalAutomation} from '../services/atp-municipal-automation-runtime.mjs';
// Private timer, never an ATP Bearer endpoint. Deployment gates remain OFF.
app.timer('atp-municipal-automation',{
 schedule:'15 * * * * *',useMonitor:true,runOnStartup:false,
 handler:async(_timer,context)=>{try{const r=await runAzureAtpMunicipalAutomation();if(r.visited)context.log(JSON.stringify(r));}catch{context.error('ATP: automação municipal não concluída; revisar checkpoint privado.');}},
});
