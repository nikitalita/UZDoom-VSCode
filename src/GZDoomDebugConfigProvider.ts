import { DEFAULT_PORT, GAME_LABEL_NAME, GAME_NAME, isBuiltinPK3File, ProjectItem, searchForGZDoomBinary as searchForGameBinary } from "./GZDoomGame";
import * as vscode from 'vscode';
import path from "path";
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { VSCodeFileAccessor as WorkspaceFileAccessor } from './VSCodeInterface';

const workspaceFileAccessor = new WorkspaceFileAccessor();

export interface ConfigurationDescriptor {
    label: string;
    description: string;
    body: DebugConfiguration;
}

export class gzdoomConfigurationProvider implements vscode.DebugConfigurationProvider {
    async fixProjects(projects, workspaceFolder: string | undefined): Promise<ProjectItem[]> {
        let new_projects: ProjectItem[] = [];
        for (let project of projects) {
            if (typeof project === 'string') {
                project = { path: path.normalize(project), archive: path.normalize(project) };
            } else {
                project.path = path.normalize(project.path);
            }
            if (!project.archive) {
                project.archive = project.path;
            }

            // if project.path or project.archive is not absolute, make it absolute
            if (workspaceFolder) {
                if (!path.isAbsolute(project.path)) {
                    project.path = path.join(workspaceFolder, project.path);
                }
                if (!path.isAbsolute(project.archive) && !isBuiltinPK3File(project.archive)) {
                    project.archive = path.join(workspaceFolder, project.archive);
                }
            }
            project.archive = path.normalize(project.archive);
            // if it says it's a directory or the extension is nothing
            if (!project.archive.endsWith('/') && (await workspaceFileAccessor.isDirectory(project.archive) || path.extname(path.basename(project.archive)) === '')) {
                project.archive += '/';
            }
            new_projects.push(project);
        }
        return new_projects;
    }
    /**
     * Massage a debug configuration just before a debug session is being launched,
     * e.g. add all missing attributes to the debug configuration.
     */
    async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration> {
        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && (editor.document.languageId === 'zscript' || editor.document.languageId === 'acs' || editor?.document.languageId === 'decorate')) {
                config.type = 'gzdoom';
                config.name = 'Attach';
                config.request = 'attach';
                config.port = DEFAULT_PORT;
            }
        }
        if (!config.projects && folder) {
            config.projects = [folder];
        }
        if (!config.port) {
            config.port = DEFAULT_PORT;
        }
        return config;
    }

    // called directly after resolveDebugConfiguration
    async resolveDebugConfigurationWithSubstitutedVariables(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration> {
        config.projects = await this.fixProjects(config.projects, folder?.uri.fsPath);
        return config;
    }

    static GZDoomAttachDefaultConfig: DebugConfiguration = {
        type: 'gzdoom',
        name: 'gzdoom Attach',
        request: 'attach',
        port: DEFAULT_PORT,
        projects: ['${workspaceFolder}'],
    };

    static GZDoomLaunchDefaultConfig: DebugConfiguration = {
        type: 'gzdoom',
        name: 'gzdoom Launch',
        request: 'launch',
        gzdoomPath: `<PUT_${GAME_NAME.toUpperCase()}_PATH_HERE>`,
        cwd: '${workspaceFolder}',
        port: DEFAULT_PORT,
        projects: ['${workspaceFolder}'],
        iwad: 'doom2.wad',
        configPath: '',
        map: '',
        additionalArgs: []
    };

    static defaultConfigs: DebugConfiguration[] = [
        gzdoomConfigurationProvider.GZDoomAttachDefaultConfig,
        gzdoomConfigurationProvider.GZDoomLaunchDefaultConfig,
    ];

    static defaultLabels: string[] = [
        `${GAME_LABEL_NAME}: Attach`,
        `${GAME_LABEL_NAME}: Launch`,
    ];

    static defaultDescriptions: string[] = [
        `Attach to a running ${GAME_LABEL_NAME} instance`,
        `Launch current ${GAME_LABEL_NAME} project`,
    ];

    public static getGamePath(): string | null {
        return searchForGameBinary();
    }

    static getDefaultConfigs(): DebugConfiguration[] {
        const gzdoomPath = gzdoomConfigurationProvider.getGamePath();
        let configs: DebugConfiguration[] = gzdoomConfigurationProvider.defaultConfigs;
        if (gzdoomPath) {
            for (let config of configs) {
                if (config.gzdoomPath) {
                    config.gzdoomPath = gzdoomPath;
                }
            }
        }
        return configs;
    }

    static getDefaultConfigurationDescriptors(): ConfigurationDescriptor[] {
        const configs = gzdoomConfigurationProvider.getDefaultConfigs();
        const descriptors: ConfigurationDescriptor[] = [];
        for (let i = 0; i < configs.length; i++) {
            const descriptor: ConfigurationDescriptor = {
                "label": gzdoomConfigurationProvider.defaultLabels[i],
                "description": gzdoomConfigurationProvider.defaultDescriptions[i],
                "body": configs[i],
            }
            descriptors.push(descriptor);
        }
        return descriptors;
    }


    provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
        return gzdoomConfigurationProvider.getDefaultConfigs();
    }

}


export function registerGZDoomDebugConfigurationProvider(context: vscode.ExtensionContext) {
    const provider = new gzdoomConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('gzdoom', provider));
    // register a command to get the GZDoom binary path
    context.subscriptions.push(vscode.commands.registerCommand('gzdoom.debug.searchForGamePath', () => {
        return gzdoomConfigurationProvider.getGamePath();
    }));
}
