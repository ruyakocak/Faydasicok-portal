const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ProfileTabs.tsx', 'utf-8');
code = code.replace('const items = [];', 'const items: any[] = [];');
fs.writeFileSync('frontend/src/components/ProfileTabs.tsx', code);
console.log('Fixed TS error');

