import { topics,faq,archives,site } from '../src/lib/data-node.mjs';
import { validateContent } from '../src/lib/validation.mjs';
console.log('Content valid:',validateContent({topics,faq,archives,site}));
