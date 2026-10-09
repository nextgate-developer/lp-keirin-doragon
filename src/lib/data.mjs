import { assembleContent,loadContent } from './content.mjs';
// Eager imports let Astro watch JSON edits and refresh the local preview.
const files=import.meta.glob('../data/**/*.json',{eager:true,import:'default'});
const content=process.env.KD_DATA_DIR ? loadContent(process.env.KD_DATA_DIR) : assembleContent({
  site:files['../data/site.json'],faq:files['../data/faq.json'],archives:files['../data/archives.json'],
  topics:Object.entries(files).filter(([name])=>name.startsWith('../data/topics/')).map(([,value])=>value),
});
export const {site,topics,faq,archives,featured,months,categories}=content;
