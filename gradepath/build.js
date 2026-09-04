/*
 * Bundles the app into two single-file builds:
 *   dist/gradepath.html - a standalone page you can email or open offline
 *   dist/artifact.html  - the same page as a fragment, for hosts that supply
 *                         their own <head> (used for the published version)
 * No dependencies:  node build.js
 */
var fs = require('fs');
var path = require('path');

var root = __dirname;
var read = function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); };

var html = read('index.html');
var css = read('assets/styles.css');
var js = read('assets/gpa.js') + '\n' + read('assets/app.js');

var inlined = html
  .replace('<link rel="stylesheet" href="assets/styles.css">', '<style>\n' + css + '\n</style>')
  .replace(/<script src="assets\/gpa\.js"><\/script>\s*<script src="assets\/app\.js"><\/script>/,
           '<script>\n' + js + '\n</script>');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/gradepath.html'), inlined);

/* The fragment build keeps the title, the web fonts and the styles, but drops
   the document shell that the host supplies. */
var body = inlined.slice(inlined.indexOf('<body>') + 6, inlined.lastIndexOf('</body>'));
var title = '<title>GradePath</title>';
var fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [''])[0];
var style = inlined.slice(inlined.indexOf('<style>'), inlined.indexOf('</style>') + 8);
fs.writeFileSync(path.join(root, 'dist/artifact.html'),
  title + '\n' + fonts + '\n' + style + '\n' + body.trim() + '\n');

console.log('dist/gradepath.html  ' + (inlined.length / 1024).toFixed(1) + ' KB');
console.log('dist/artifact.html   ' + ((title + style + body).length / 1024).toFixed(1) + ' KB');
