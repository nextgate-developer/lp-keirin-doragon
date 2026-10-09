import fs from 'node:fs';
fs.mkdirSync('.generated-public', { recursive: true });
fs.cpSync('assets', '.generated-public/assets', { recursive: true });
fs.copyFileSync('CNAME', '.generated-public/CNAME');
fs.copyFileSync('site-config.js', '.generated-public/site-config.js');
fs.writeFileSync('.generated-public/.nojekyll', '');
