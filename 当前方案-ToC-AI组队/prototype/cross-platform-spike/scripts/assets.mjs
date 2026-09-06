// Build-only mechanical extraction. Never execute the legacy app or duplicate its fixture records.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { renderUiIcon } from '../../mobile-demo/assets/ui-icons.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacy = path.resolve(root, '../mobile-demo');
const out = path.join(root, 'src/static/generated');
fs.mkdirSync(out, { recursive: true });
const source = ts.createSourceFile('app.js', fs.readFileSync(path.join(legacy, 'app.js'), 'utf8'), ts.ScriptTarget.Latest, true);
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
    if (!ts.isPropertyAssignment(p)) throw Error('Fixture must be a literal');
    return [p.name.text, literal(p.initializer)];
  }));
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  throw Error('Unexpected executable fixture syntax');
}
function declaration(name) {
  for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
    for (const d of statement.declarationList.declarations) if (d.name.getText(source) === name) return literal(d.initializer);
  }
  throw Error('Missing fixture: ' + name);
}
const records = declaration('people'), profiles = declaration('participantProfiles'), hours = declaration('availabilityHoursByPerson');
fs.writeFileSync(path.join(out, 'fixtures.json'), JSON.stringify({ records, profiles, hours }, null, 2));
for (const name of ['close','details','wave','filter','back','event','nearby','discover','connections','collaboration','profile']) {
  for (const [tone, color] of Object.entries({ ink: '#475463', white: '#ffffff', blue: '#347cf8', muted: '#87928d' })) {
    fs.writeFileSync(path.join(out, `${name}-${tone}.svg`), renderUiIcon(name, color));
  }
}
fs.copyFileSync(path.join(legacy, 'assets/default-memoji-grid.jpg'), path.join(out, 'default-memoji-grid.jpg'));
const css = fs.readFileSync(path.join(legacy, 'styles.css'), 'utf8');
const declarations = css.slice(css.indexOf(':root {') + 7, css.indexOf('\n}'));
fs.writeFileSync(path.join(out, 'tokens.css'), `/* Generated from approved mobile Web tokens. */\npage, .app {${declarations}\n}\n`);
const avatarRules = css.match(/\.memoji-\d+\s*\{[^}]+\}/g).join('\n');
fs.writeFileSync(path.join(out, 'avatars.css'), avatarRules);
const avatarPositions = Object.fromEntries([...avatarRules.matchAll(/\.(memoji-\d+)\s*\{\s*background-position:\s*([\d.]+)%\s*([\d.]+)%/g)].map(([, name, x, y]) => [name, { left: -3.5 * Number(x), top: -5 * Number(y) }]));
fs.writeFileSync(path.join(out, 'avatar-positions.json'), JSON.stringify(avatarPositions, null, 2));
const audioNames = ['SWIPE_CUE_VOLUME', 'swipeCueProfiles', 'getSwipeNoiseBuffer', 'scheduleSwipeCue'];
const audio = source.statements.filter(s => ts.isFunctionDeclaration(s) ? audioNames.includes(s.name?.text) : ts.isVariableStatement(s) && s.declarationList.declarations.some(d => audioNames.includes(d.name.getText(source))));
fs.writeFileSync(path.join(out, 'audio.js'), `// Generated from original Web sound synthesis.\nlet swipeNoiseBuffer = null;\n${audio.map(s => s.getText(source)).join('\n')}\nexport { scheduleSwipeCue };\n`);
fs.writeFileSync(path.join(out, 'audio.d.ts'), 'export function scheduleSwipeCue(context: AudioContext, direction: "left" | "right"): void;\n');
console.log('Generated original fixture records, SVG paths, avatar asset and design tokens.');
