/*
   MindRiot Labs - Sitemap Generator
   Generates a fresh sitemap.xml file for search engine indexation.
*/

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://mindriotlabs.com';
const lastModDate = new Date().toISOString().split('T')[0];

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Main Landing Page -->
    <url>
        <loc>${DOMAIN}/</loc>
        <lastmod>${lastModDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <!-- Anchor sections for quick indexing support -->
    <url>
        <loc>${DOMAIN}/#home</loc>
        <lastmod>${lastModDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${DOMAIN}/#about</loc>
        <lastmod>${lastModDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${DOMAIN}/#pricing</loc>
        <lastmod>${lastModDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${DOMAIN}/#cases</loc>
        <lastmod>${lastModDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${DOMAIN}/#tools</loc>
        <lastmod>${lastModDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>
`;

try {
    const outputPath = path.join(__dirname, 'sitemap.xml');
    fs.writeFileSync(outputPath, sitemapContent.trim(), 'utf8');
    console.log(`[Sitemap Generator] Successfully generated sitemap.xml at: ${outputPath}`);
} catch (err) {
    console.error('[Sitemap Generator] Failed to write sitemap.xml:', err);
    process.exit(1);
}
