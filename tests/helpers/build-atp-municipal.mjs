import {args} from './atp-municipal-fixture.mjs';
import {buildAtpMunicipal} from '../../admin-api/src/services/atp-municipal-model.mjs';
const i=process.argv[2]==='CPF'?{...args.input,recipient:{...args.input.recipient,documentType:'CPF',document:'52998224725'}}:args.input;
console.log(JSON.stringify(buildAtpMunicipal({...args,input:i})));
