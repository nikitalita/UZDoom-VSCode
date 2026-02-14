import * as vscode from 'vscode';
const foldingRegionStart = /^\s*(?:(?:\[(CODEPTR|PARS|STRINGS|SPRITES|SOUNDS|MUSIC|HELPER)\])|(?:Text \d+ \d+)|(?:(Pointer|Thing|Frame|Sprite|Sound|Ammo|Weapon|Cheat|Misc|Text)\s+(\d+)(?:\s*\((.+)\))?))(\s*(?:#|\/\/).*)?\s*$/i;
export function activateDehackedFoldingProvider(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider('dehacked', {
        provideFoldingRanges(document, context, token) {
            //console.log('folding range invoked'); // comes here on every character edit
            let sectionStart = 0, FR: vscode.FoldingRange[] = [];  // regex to detect start of region

            for (let i = 0; i < document.lineCount; i++) {

                if (foldingRegionStart.test(document.lineAt(i).text)) {
                    if (sectionStart > 0) {
                        var extra = document.lineAt(i - 1).text.trim() == '' ? 1 : 0;
                        FR.push(new vscode.FoldingRange(sectionStart, i - (1 + extra), vscode.FoldingRangeKind.Region));
                    }
                    sectionStart = i;
                }
            }
            if (sectionStart > 0) { FR.push(new vscode.FoldingRange(sectionStart, document.lineCount - 1, vscode.FoldingRangeKind.Region)); }

            return FR;
        }
    }));

}