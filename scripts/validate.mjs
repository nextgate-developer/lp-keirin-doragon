import { topics,faq,archives,site } from '../src/lib/data-node.mjs';
import { validateContent } from '../src/lib/validation.mjs';
import youtube from '../src/data/youtube.json' with {type:'json'};
import {validateYoutube} from '../src/lib/youtube.mjs';
validateYoutube(youtube);
console.log('Content valid:',validateContent({topics,faq,archives,site}));
