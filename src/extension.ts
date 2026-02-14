'use strict';

import * as vscode from 'vscode';
import { activateDebugAdapterDescriptorFactory } from './debug/GameDebugAdapterDescriptorFactory';
import { activateDehackedFoldingProvider } from './language/dehackedFoldingProvider';
import { activateDebugConfigSnippetsProvider } from './debug/DebugConfigSnippetsProvider';
import { registerGameDebugConfigurationProvider } from './debug/GameDebugConfigProvider';
import { activate as activateWadProvider } from './wad-provider/index';
import { activate as activatePk3Provider } from './pk3-provider/index';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */

export function activate(context: vscode.ExtensionContext) {
    registerGameDebugConfigurationProvider(context);
    activateWadProvider(context);
    activatePk3Provider(context);
	activateDehackedFoldingProvider(context);
    activateDebugConfigSnippetsProvider(context);
    activateDebugAdapterDescriptorFactory(context);
}

export function deactivate() {
	// nothing to do
}
