const fs = require('fs');
const filePath = 'frontend/src/components/layout/MainLayout.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find and fix the broken className function
const brokenPattern = /className=\(\(\) => \{[\s\S]*?\}\s*\n\s*>/;

const fixedPattern = `className={() => {
                // Use React Router's location for proper reactivity
                const currentPath = location.pathname + location.search;
                const itemPath = item.path;
                
                // Exact match for paths with query params
                let isCurrentlyActive;
                if (itemPath.includes('?')) {
                  isCurrentlyActive = currentPath === itemPath;
                } else if (itemPath === '/dashboard') {
                  isCurrentlyActive = location.pathname === '/dashboard' && !location.search;
                } else {
                  isCurrentlyActive = currentPath === itemPath;
                }
                
                return \`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  \${isCurrentlyActive 
                  ? \`\${colors.sidebarItemActive} \${colors.sidebarTextActive} shadow-lg\` 
                  : \`\${colors.sidebarText} \${colors.sidebarItem}\`
                }
              \`;
              }}
            >`;

content = content.replace(brokenPattern, fixedPattern);
fs.writeFileSync(filePath, content);
console.log('✅ Fixed MainLayout syntax error');
