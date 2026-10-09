import { loadContent } from './content.mjs';
export const {site,topics,faq,archives,featured,months,categories}=loadContent(process.env.KD_DATA_DIR);
