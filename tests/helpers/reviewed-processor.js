// Synthetic legacy-price tests run inside their reviewed price window.
// Runtime code still uses the actual date; no environment flag extends it.
import {createProcessor as createRealProcessor} from '../../processor/server.js';
export const createProcessor=(config,dependencies={})=>createRealProcessor(config,{
 ...dependencies,now:()=>new Date('2026-10-20T12:00:00Z')
});
