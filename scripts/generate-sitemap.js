const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://bibinantony1998.github.io/my-portfolio';
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const ROOT_DIR = path.resolve(__dirname, '../');

const EXCLUDE_FILES = [
    'google43b25b5259404c80.html',
    '404.html'
];

// Pages that should be prioritized
const PRIORITY_PAGES = {
    'index.html': 1.0,
    'family-command-center.html': 0.8,
    'portfolio-details.html': 0.8,
    'other-talents.html': 0.7
};

function getHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        // Skip node_modules, .git, dist, and public (we scan root for htmls usually in this setup, 
        // but based on previous file list, htmls are in root)
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'public' || file === 'assets') return;

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            // Recurse if needed, but for this portfolio seems flat for partials? 
            // Actually based on file list, main htmls are in root.
            // Let's stick to root files for now as verified in file list.
        } else {
            if (file.endsWith('.html') && !EXCLUDE_FILES.includes(file)) {
                results.push(file);
            }
        }
    });
    return results;
}

const htmlFiles = getHtmlFiles(ROOT_DIR);
const today = new Date().toISOString().split('T')[0];

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${htmlFiles.map(file => {
    let urlPath = file === 'index.html' ? '' : file;
    // Removing index.html from URL is standard practice, but for github pages 
    // usually /my-portfolio/ is enough for home.

    // Construct full URL
    const loc = urlPath ? `${BASE_URL}/${urlPath}` : `${BASE_URL}/`;

    const priority = PRIORITY_PAGES[file] || 0.6;

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join('\n')}
</urlset>`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapContent);
console.log(`Sitemap generated with ${htmlFiles.length} URLs at ${path.join(PUBLIC_DIR, 'sitemap.xml')}`);
