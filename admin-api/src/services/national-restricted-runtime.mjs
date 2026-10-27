import {createNationalRestrictedClient} from './national-restricted-client.mjs';
import {createRestrictedDpsLedger} from './national-restricted-ledger.mjs';
import {createNationalRestrictedWorkStore} from './national-restricted-work-store.mjs';
import {createNationalRestrictedWorkflow} from './national-restricted-workflow.mjs';
import {createWindowsRestrictedTransport,createWindowsRestrictedSigner} from './national-windows-process.mjs';

// Explicit internal composition for a supervised Windows runner. No startup,
// route registration, general flag or production fallback occurs on import.
export function createWindowsNationalRestrictedRuntime({repository,table,blobs,environment}){
 if(environment!=='homologacao'||process.platform!=='win32')throw Error('RESTRICTED_WINDOWS_ONLY');
 const client=createNationalRestrictedClient({transport:createWindowsRestrictedTransport(),ledger:createRestrictedDpsLedger(table)});
 return createNationalRestrictedWorkflow({repository,works:createNationalRestrictedWorkStore({table,blobs}),client,sign:createWindowsRestrictedSigner(),environment});
}
