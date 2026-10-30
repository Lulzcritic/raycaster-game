import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Démarrage des tests de métadonnées OpenGraph & Discord Embeds...\n');

// 1. Vérification de l'image de couverture originale
console.log('1. Vérification de l\'image de cover dans textures/...');
const originalCoverPath = path.resolve(process.cwd(), 'src/assets/textures/cover.jpg');
assert.ok(fs.existsSync(originalCoverPath), 'Le fichier cover.jpg doit exister dans src/assets/textures/');
const coverStats = fs.statSync(originalCoverPath);
assert.ok(coverStats.size > 50000, 'L\'image de couverture doit être un fichier valide de bonne résolution');
console.log(`   ✅ Image de cover trouvée (${(coverStats.size / 1024).toFixed(1)} KB).`);

// 2. Vérification des copies publiques pour Vite et le serveur
console.log('2. Vérification de la présence dans public/ et public/toc/...');
const publicCover = path.resolve(process.cwd(), 'public/cover.jpg');
const publicTocCover = path.resolve(process.cwd(), 'public/toc/cover.jpg');
assert.ok(fs.existsSync(publicCover), 'public/cover.jpg doit exister pour la distribution statique');
assert.ok(fs.existsSync(publicTocCover), 'public/toc/cover.jpg doit exister pour les requêtes relatives à /toc/');
assert.strictEqual(fs.statSync(publicCover).size, coverStats.size, 'public/cover.jpg doit être identique à textures/cover.jpg');
assert.strictEqual(fs.statSync(publicTocCover).size, coverStats.size, 'public/toc/cover.jpg doit être identique');
console.log('   ✅ Fichiers publics cover.jpg et toc/cover.jpg prêts pour le build.');

// 3. Vérification des balises HTML dans index.html
console.log('3. Vérification des balises Open Graph et Twitter Card pour Discord...');
const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');

// A. URL canonique et ciblée
assert.ok(html.includes('<meta property="og:url" content="https://lulz.space/toc" />'), 'og:url doit cibler https://lulz.space/toc');
assert.ok(html.includes('<meta name="twitter:url" content="https://lulz.space/toc" />'), 'twitter:url doit cibler https://lulz.space/toc');
assert.ok(html.includes('<link rel="canonical" href="https://lulz.space/toc" />'), 'Lien canonique vers https://lulz.space/toc requis');

// B. Image de cover
assert.ok(html.includes('<meta property="og:image" content="https://lulz.space/toc/cover.jpg" />'), 'og:image doit pointer vers l\'URL absolue de la cover');
assert.ok(html.includes('<meta property="og:image:secure_url" content="https://lulz.space/toc/cover.jpg" />'), 'og:image:secure_url requis pour HTTPS');
assert.ok(html.includes('<meta name="twitter:image" content="https://lulz.space/toc/cover.jpg" />'), 'twitter:image requis pour Discord');

// C. Twitter Card en summary_large_image (impératif pour un grand affichage sur Discord)
assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'), 'twitter:card summary_large_image impératif pour l\'affichage large sur Discord');

// D. Titre et description
assert.ok(html.includes('<meta property="og:title"'), 'og:title doit être défini');
assert.ok(html.includes('<meta property="og:description"'), 'og:description doit être défini');
assert.ok(html.includes('<meta name="twitter:title"'), 'twitter:title doit être défini');
assert.ok(html.includes('<meta name="twitter:description"'), 'twitter:description doit être défini');
assert.ok(html.includes('<meta name="description"'), 'meta description standard requise');

// E. Thème Discord (couleur d'accentuation)
assert.ok(html.includes('<meta name="theme-color"'), 'theme-color requis pour le liseré coloré Discord');
console.log('   ✅ Toutes les métadonnées Open Graph, Twitter Cards et Discord Embeds sont conformes.');

// 4. Test des dimensions de l'image (1376x768 - format large 16:9)
console.log('4. Vérification du ratio d\'image 16:9 pour Discord...');
assert.ok(html.includes('content="1376"'), 'og:image:width doit spécifier la largeur 1376px');
assert.ok(html.includes('content="768"'), 'og:image:height doit spécifier la hauteur 768px');
console.log('   ✅ Spécifications 1376x768 (16:9) configurées pour un rendu Discord instantané.');

console.log('\n======================================================');
console.log('🎉 TOUS LES TESTS DE MÉTADONNÉES DISCORD ONT RÉUSSI !');
console.log('======================================================\n');
