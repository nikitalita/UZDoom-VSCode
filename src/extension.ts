'use strict';

import * as vscode from 'vscode';
import { activateGameDebug } from './activateDebug';
import { activateDehackedFoldingProvider } from './dehackedFoldingProvider';
import { activateDebugSnippetsProvider } from './snippetsProvider';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */

export function activate(context: vscode.ExtensionContext) {
	activateDehackedFoldingProvider(context);
    activateDebugSnippetsProvider(context);
    activateGameDebug(context);
}

export function deactivate() {
	// nothing to do
}
