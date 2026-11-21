import { readFileSync, writeFileSync } from 'fs';

const filePath = 'packages/coding-agent/src/modes/interactive/interactive-mode.ts';
const content = readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the closing brace of the class (last `}` before the final empty line)
const insertIdx = lines.length - 2; // before the closing `}`

const method = `
\t/** Handle the /todo slash command: add, list, or complete todo items for the current session. */
\tprivate handleTodoCommand(args: string): void {
\t\tconst parts = args.split(' ');
\t\tconst subcommand = parts[0];

\t\tif (subcommand === 'add') {
\t\t\tconst text = parts.slice(1).join(' ');
\t\t\tif (!text.trim()) {
\t\t\t\tthis.showStatus('Usage: /todo add <text>');
\t\t\t\treturn;
\t\t\t}
\t\t\tconst item = this.todoManager.add(text);
\t\t\tthis.showStatus(\`Added todo #\${item.id}: \${text}\`);
\t\t} else if (subcommand === 'list' || subcommand === '') {
\t\t\tconst todos = this.todoManager.list();
\t\t\tif (todos.length === 0) {
\t\t\t\tthis.showStatus('No todos yet');
\t\t\t\treturn;
\t\t\t}
\t\t\tconst todoLines = todos.map((t) => {
\t\t\t\tconst status = t.completed ? 'x' : ' ';
\t\t\t\treturn \`[\${status}] #\${t.id}: \${t.text}\`;
\t\t\t});
\t\t\tthis.showStatus('Todos:\\n' + todoLines.join('\\n'));
\t\t} else if (subcommand === 'complete') {
\t\t\tconst id = parts[1];
\t\t\tif (!id) {
\t\t\t\tthis.showStatus('Usage: /todo complete <id>');
\t\t\t\treturn;
\t\t\t}
\t\t\tconst item = this.todoManager.complete(id);
\t\t\tif (item) {
\t\t\t\tthis.showStatus(\`Completed todo #\${id}: \${item.text}\`);
\t\t\t} else {
\t\t\t\tthis.showStatus(\`Todo #\${id} not found\`);
\t\t\t}
\t\t} else {
\t\t\tthis.showStatus('Usage: /todo [add <text>|list|complete <id>]');
\t\t}
\t}`;

lines.splice(insertIdx, 0, method);
writeFileSync(filePath, lines.join('\n'));
console.log('Done');
