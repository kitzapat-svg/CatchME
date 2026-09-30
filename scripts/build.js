const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const stylesHtml = fs.readFileSync(path.join(srcDir, 'Styles.html'), 'utf8');
const appHtml = fs.readFileSync(path.join(srcDir, 'App.html'), 'utf8');
const parserGs = fs.readFileSync(path.join(srcDir, 'Parser.gs'), 'utf8');
const scriptsHtml = fs.readFileSync(path.join(srcDir, 'Scripts.html'), 'utf8');

const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#FF8FAB">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="CatchME">
  <title>CatchME — Medication Error Cat B Quick Reporter</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Prompt:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
${stylesHtml}
</head>
<body>
${appHtml}

  <script>
    // Embedded Rule-based Parser Engine
${parserGs}
  </script>
${scriptsHtml}
</body>
</html>
`;

fs.writeFileSync(path.join(rootDir, 'index.html'), htmlContent, 'utf8');
fs.writeFileSync(path.join(rootDir, 'tests', 'preview.html'), htmlContent, 'utf8');

console.log('Build completed: index.html and tests/preview.html generated successfully.');

