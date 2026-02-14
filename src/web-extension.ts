
import * as vscode from 'vscode';
import { activateDehackedFoldingProvider } from './language/dehackedFoldingProvider';

export function activate(context: vscode.ExtensionContext) {
    activateDehackedFoldingProvider(context);
}

export function deactivate() {
	// nothing to do
}
