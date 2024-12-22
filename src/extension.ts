import * as vscode from 'vscode';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { openExplorer } from './openFileExplorer';
import { HSnippet } from './hsnippet';
import { HSnippetInstance } from './hsnippetInstance';
import { parse } from './parser';
import { getSnippetDir } from './utils';
import { getCompletions, CompletionInfo } from './completion';
import { COMPLETIONS_TRIGGERS } from './consts';

const SNIPPETS_BY_LANGUAGE: Map<string, HSnippet[]> = new Map();
const SNIPPET_STACK: HSnippetInstance[] = [];

let insertingSnippet = false;

async function loadSnippets() {
    SNIPPETS_BY_LANGUAGE.clear();

    let snippetDir = getSnippetDir();
    if (!existsSync(snippetDir)) {
        mkdirSync(snippetDir, { recursive: true });
    }

    for (let file of readdirSync(snippetDir)) {
        if (path.extname(file).toLowerCase() != '.hsnips') continue;

        let filePath = path.join(snippetDir, file);
        let fileData = readFileSync(filePath, 'utf8');

        let language = path.basename(file, '.hsnips').toLowerCase();

        SNIPPETS_BY_LANGUAGE.set(language, parse(fileData));
    }

    let globalSnippets = SNIPPETS_BY_LANGUAGE.get('all');
    if (globalSnippets) {
        for (let [language, snippetList] of SNIPPETS_BY_LANGUAGE.entries()) {
            if (language != 'all') snippetList.push(...globalSnippets);
        }
    }

    // Sort snippets by descending priority.
    for (let snippetList of SNIPPETS_BY_LANGUAGE.values()) {
        snippetList.sort((a, b) => b.priority - a.priority);
    }
}

// This function may be called after a snippet expansion, in which case the original text was
// replaced by the snippet label, or it may be called directly, as in the case of an automatic
// expansion. Depending on which case it is, we have to delete a different editor range before
// triggering the real hsnip expansion.
export async function expandSnippet(
    completion: CompletionInfo,
    editor: vscode.TextEditor,
    snippetExpansion = false
) {
    let snippetInstance = new HSnippetInstance(
        completion.snippet,
        editor,
        completion.range.start,
        completion.groups
    );

    insertingSnippet = true;
    const snippet = new vscode.SnippetString(snippetInstance.snippetString.value);
    let insertionRange: vscode.Range | vscode.Position = completion.range.start;
    await editor.edit(
        (eb) => {
            eb.delete(snippetExpansion ? completion.completionRange : completion.range);
        },
        { undoStopAfter: false, undoStopBefore: !snippetExpansion }
    );
    await editor.insertSnippet(snippet, insertionRange, { undoStopAfter: false, undoStopBefore: !snippetExpansion });

    if (snippetInstance.selectedPlaceholder != 0) SNIPPET_STACK.unshift(snippetInstance);
    insertingSnippet = false;
}

export function activate(context: vscode.ExtensionContext) {
    loadSnippets();

    context.subscriptions.push(
        vscode.commands.registerCommand('hsnips.openSnippetsDir', () => openExplorer(getSnippetDir()))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('hsnips.openSnippetFile', async () => {
            let snippetDir = getSnippetDir();
            let files = readdirSync(snippetDir);
            let selectedFile = await vscode.window.showQuickPick(files);

            if (selectedFile) {
                let document = await vscode.workspace.openTextDocument(path.join(snippetDir, selectedFile));
                vscode.window.showTextDocument(document);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('hsnips.reloadSnippets', () => loadSnippets())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('hsnips.leaveSnippet', () => {
            while (SNIPPET_STACK.length) SNIPPET_STACK.pop();
            vscode.commands.executeCommand('leaveSnippet');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('hsnips.nextPlaceholder', () => {
            if (SNIPPET_STACK[0] && !SNIPPET_STACK[0].nextPlaceholder()) {
                SNIPPET_STACK.shift();
            }
            vscode.commands.executeCommand('jumpToNextSnippetPlaceholder');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('hsnips.prevPlaceholder', () => {
            if (SNIPPET_STACK[0] && !SNIPPET_STACK[0].prevPlaceholder()) {
                SNIPPET_STACK.shift();
            }
            vscode.commands.executeCommand('jumpToPrevSnippetPlaceholder');
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId == 'hsnips') {
                loadSnippets();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand(
            'hsnips.expand',
            (editor, _, completion: CompletionInfo) => {
                expandSnippet(completion, editor, true);
            }
        )
    );

    function isMathEnvironment(editor: vscode.TextEditor) {
        let text = editor.document.getText(new vscode.Range(new vscode.Position(0, 0), editor.selection.start))
        text = text.replace(/\\\$/g, ' ')
        text = text.replace(/```[\s\S]+?```/g, '')
        text = text.replace(/`[^`\n]+`/g, '')
        text = text.replace(/<!--[\s\S]+?-->/g, '')
        text = text.replace(/(\$\$[^\$]+\$\$)|(\$[^\$]+?\$)/g, '') // avoid activating math env in cases such as \begin{equation} a = \text{$b$} \end{equation} //math env is activate after the equation
        const reg = /(\\begin\{gather\*\}[^\$]*?\\end\{gather\*\})|(\\begin\{gather\}[^\$]*?\\end\{gather\})|(\\begin\{align\*\}[^\$]*?\\end\{align\*\})|(\\begin\{align\}[^\$]*?\\end\{align\})|(\\begin\{equation\*\}[^\$]*?\\end\{equation\*\})|(\\begin\{equation\}[^\$]*?\\end\{equation\})|(\\\[[^\$]*?\\\])|(\\\([^\$]*?\\\))|(\$\$[^\$]+\$\$)|(\$[^\$]+?\$)/g
        text = text.replace(reg, '')
        if (text.indexOf('$') == -1 && text.indexOf('\\(') == -1 && text.indexOf('\\[') == -1 && text.indexOf('\\begin{equation}') == -1 && text.indexOf('\\begin{equation*}') == -1 && text.indexOf('\\begin{align}') == -1 && text.indexOf('\\begin{align*}') == -1 && text.indexOf('\\begin{gather}') == -1 && text.indexOf('\\begin{gather*}') == -1) {
            return false
        } else {
            const txt_reg = /(\\text{[^}]+})|(\\operatorname{[^}\n]+})|(\\mathrm{[^}\n]+})/g
            text = text.replace(txt_reg, ' ')
            if (text.indexOf('\\text{') == -1 && text.indexOf('\\operatorname{') == -1 && text.indexOf('\\mathrm{') == -1) {
                return true
            } else {
                return false
            }
        }
    }

    // Forward all document changes so that the active snippet can update its related blocks.
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {

            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const document = editor.document;
                const languageId = document.languageId;
                const extname = path.extname(document.fileName).slice(1).toLowerCase();
                console.log(`The language identifier of the current file is: ${languageId} or ${extname}`);
            }
            if (SNIPPET_STACK.length && SNIPPET_STACK[0].editor.document == e.document) {
                SNIPPET_STACK[0].update(e.contentChanges);
            }

            if (insertingSnippet) return;

            let mainChange = e.contentChanges[0];

            if (!mainChange) return;

            // Let's try to detect only events that come from keystrokes.
            if (mainChange.text.length != 1) return;

            let snippets = SNIPPETS_BY_LANGUAGE.get(e.document.languageId.toLowerCase());
            if (!snippets) {
                let extname = path.extname(e.document.fileName).slice(1).toLowerCase();
                // remove the first character in extname
                snippets = SNIPPETS_BY_LANGUAGE.get(extname);
            }
            if (!snippets) snippets = SNIPPETS_BY_LANGUAGE.get('all');
            if (!snippets) return;

            let mainChangePosition = mainChange.range.start.translate(0, mainChange.text.length);
            let completions = getCompletions(e.document, mainChangePosition, snippets);

            // When an automatic completion is matched it is returned as an element, we check for this by
            // using !isArray, and then expand the snippet.
            if (completions && !Array.isArray(completions)) {
                let editor = vscode.window.activeTextEditor;
                if (editor && e.document == editor.document &&
                    (!completions.snippet.math || isMathEnvironment(editor))) {
                    expandSnippet(completions, editor);
                    return;
                }
            }
        })
    );

    // Remove any stale snippet instances.
    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(() => {
            while (SNIPPET_STACK.length) SNIPPET_STACK.pop();
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((e) => {
            while (SNIPPET_STACK.length) {
                if (e.selections.some((s) => SNIPPET_STACK[0].range.contains(s))) {
                    break;
                }
                SNIPPET_STACK.shift();
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider("*", {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                let snippets = SNIPPETS_BY_LANGUAGE.get(document.languageId.toLowerCase());
                if (!snippets) {
                    let extname = path.extname(document.fileName).slice(1).toLowerCase();
                    snippets = SNIPPETS_BY_LANGUAGE.get(extname);
                }
                if (!snippets) snippets = SNIPPETS_BY_LANGUAGE.get('all');
                if (!snippets) return;

                // When getCompletions returns an array it means no auto-expansion was matched for the
                // current context, in this case show the snippet list to the user.
                let completions = getCompletions(document, position, snippets);
                if (completions && Array.isArray(completions)) {
                    let editor = vscode.window.activeTextEditor;
                    return completions.filter((c) => {
                        if (editor && (!c.snippet.math || isMathEnvironment(editor))) {
                            return true
                        } else {
                            return false
                        }
                    }).map((c) => c.toCompletionItem());
                }
            },
        },
        ...COMPLETIONS_TRIGGERS
        )
    );
}
