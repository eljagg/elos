const fs = require('fs');
const filePath = 'frontend/src/components/layout/MainLayout.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix line 175 - needs }} not just }
content = content.replace(
  /(\s+)\`\}\n(\s+)>/,
  '$1`;\n$2}}\n$2>'
);

fs.writeFileSync(filePath, content);
console.log('✅ Fixed closing braces');
