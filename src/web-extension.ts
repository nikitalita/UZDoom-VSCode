
import * as vscode from 'vscode';
import { activateDehackedFoldingProvider } from './language/dehackedFoldingProvider';
import { activate as activatePk3Provider } from './pk3-provider/index';
import { activate as activateWadProvider } from './wad-provider/index';

export function activate(context: vscode.ExtensionContext) {
    activateDehackedFoldingProvider(context);
    activatePk3Provider(context);
    activateWadProvider(context);
}

export function deactivate() {
	// nothing to do
}
