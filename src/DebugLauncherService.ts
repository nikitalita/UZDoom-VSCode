import { CancellationToken, CancellationTokenSource, window } from 'vscode';
import { ChildProcess, spawn } from 'node:child_process';
import waitPort from 'wait-port';
import findProcess from 'find-process';
import { lsof, ProcessInfo } from 'list-open-files';
import path from 'path';
import { GAME_NAME } from './GameDefs';

export enum DebugLaunchState {
    success,
    launcherError,
    gameFailedToStart,
    gameExitedBeforeOpening,
    multipleGamesRunning,
    cancelled,
}
export interface IDebugLauncherService {
    tearDownAfterDebug(): Promise<boolean>;
    runLauncher(
        launcherCommand: LaunchCommand,
        portToCheck: number,
        cancellationToken?: CancellationToken
    ): Promise<DebugLaunchState>;
    getLaunchCommandFromRunningProcess(port: number, game_name: string): Promise<LaunchCommand | undefined>;
}

export interface LaunchCommand {
    command: string;
    args: string[];
    cwd?: string;
}
export class DebugLauncherService implements IDebugLauncherService {

    // TODO: Move this stuff into the global Context
    private cancellationTokenSource: CancellationTokenSource | undefined;
    public launcherProcess: ChildProcess | undefined;
    // @ts-ignore
    private gamePID: number | undefined;
    private gameName: string = GAME_NAME;
    // @ts-ignore
    private errorString: string = '';
    constructor() {
    }
    public reset() {
        this.launcherProcess = undefined;
        this.gamePID = undefined;
        this.gameName = GAME_NAME;
        this.errorString = '';
    }

    async getGameIsRunning(game_name: string = this.gameName) {
        // check if we're on windows

        if (game_name.toLowerCase().endsWith('.exe')) {
            game_name = game_name.slice(0, -4);
        }

        const processList = await findProcess('name', game_name, false);
        return processList.length > 0;
    }

    async getGamePIDs(game_name: string = this.gameName): Promise<Array<number>> {
        if (game_name.endsWith('.exe')) {
            game_name = game_name.slice(0, -4);
        }
        const gameProcesses = await findProcess('name', game_name, false);

        if (gameProcesses.length === 0) {
            return [];
        }

        return gameProcesses.map((p) => p.pid);
    }

    async getLaunchCommandFromRunningProcess(port: number, game_name: string = this.gameName): Promise<LaunchCommand | undefined> {
        if (game_name.endsWith('.exe')) {
            game_name = game_name.slice(0, -4);
        }
        let process = await findProcess('port', port, false);
        if (process.length === 0) {
            // just look for the game name
            process = await findProcess('name', game_name, false);
            if (process.length === 0) {
                return undefined;
            } else if (process.length > 1) {
                console.error(`Found multiple ${game_name} processes running on port ${port}`);
            }
        }
        let argv: string[] = []
        // we need to split on spaces, but not between single or double quotes
        let quote = '';
        let currentArg = '';
        for (let char of process[0]?.cmd || '') {
            if (char === '"' || char === "'") {
                if (quote === '') {
                    quote = char;
                } else if (char === quote) {
                    quote = '';
                    char = ' ';
                }
            }
            if (char === ' ' && quote === '') {
                if (currentArg) {
                    argv.push(currentArg);
                    currentArg = '';
                }
            } else {
                currentArg += char;
            }
        }
        if (currentArg) {
            argv.push(currentArg);
        }
        let launchCommand: LaunchCommand = {
            command: argv[0],
            args: argv.slice(1)
        }
        try {
            let thing: ProcessInfo[] = await lsof({ pids: [process[0]?.pid] })
            if (thing.length == 0) {
                return launchCommand;
            }
            launchCommand.cwd = thing[0].process.cwd?.name || "";
            return launchCommand;
        } catch (e) {
            console.error(e);
            return launchCommand;
        }
    }

    async removeProcessListeners() {
        if (this.launcherProcess) {
            this.launcherProcess.removeAllListeners();
            this.launcherProcess.stdout?.removeAllListeners();
            this.launcherProcess.stderr?.removeAllListeners();
        }
    }

    async tearDownAfterDebug() {
        if (this.launcherProcess) {
            this.removeProcessListeners();
            try {
                if (this.launcherProcess.kill()) {
                    this.reset();
                } else if (this.launcherProcess.kill('SIGKILL')) {
                    this.reset();
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (await this.getGameIsRunning()) {
                let pids = await this.getGamePIDs();
            let retris = 0;
            while (pids.length > 0 && retris < 5) {
                for (let pid of pids) {
                    try {
                        if (retris == 0) {
                            process.kill(pid);
                        } else {
                            process.kill(pid, 'SIGKILL');
                        }
                    } catch (e) {
                        /* empty */
                    }
                }
                retris++;
                pids = await this.getGamePIDs();
            }
            if (pids.length > 0) {
                console.error(`Failed to kill game process after 5 retries`);
            }
        }

        this.reset();

        return true;
    }

    async keepSleepingUntil(startTime: number, timeout: number) {
        const currentTime = new Date().getTime();

        if (currentTime > startTime + timeout) {
            return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        return true;
    }

    async cancelLaunch() {
        if (this.cancellationTokenSource) {
            this.cancellationTokenSource.cancel();
        }
    }

    processExitedWithError() {
        return !this.launcherProcess || (this.launcherProcess.exitCode !== null && this.launcherProcess.exitCode !== 0)
    }




    /**
     *
     * @param port
     * @param connectionTimeout
     * @param intervalCallback called every 1000ms if we've failed to open the port, but haven't timed out yet; returns true if we should keep waiting
     * @param interval the interval to wait between checks
     * @returns true if the port was opened, false if we timed out
     */
    async waitForPort(port: number, connectionTimeout: number = 15000, intervalCallback: () => boolean | Promise<boolean> = () => true, interval: number = 1000) {
        let result = false;
        const startTime: number = new Date().getTime();
        while (true) {
            const currentTime = new Date().getTime();
            const timedOut = currentTime > startTime + connectionTimeout;
            if (timedOut) {
                return false;
            } else {
                result = (
                    await waitPort({
                        host: 'localhost',
                        port: port,
                        timeout: Math.min(interval, connectionTimeout),
                        interval: Math.min(interval, connectionTimeout),
                        output: 'silent',
                    })
                ).open;
                if (result || !(await intervalCallback())) {
                    break;
                }
            }
        }
        return result;
    }

    /**
     *
     * @param connectionTimeout
     * @param intervalCallback called every 1000ms if we've failed to open the port, but haven't timed out yet; returns true if we should keep waiting
     * @param interval the interval to wait between checks
     * @returns true if the port was opened, false if we timed out
     */
    async waitForGameToStart(connectionTimeout: number = 15000, intervalCallback: () => boolean | Promise<boolean> = () => true) {
        let result = false;
        const startTime: number = new Date().getTime();
        while (true) {
            const currentTime = new Date().getTime();
            const timedOut = currentTime > startTime + connectionTimeout;
            if (timedOut) {
                return false;
            } else {
                result = await this.getGameIsRunning(this.gameName);
                if (result || !(await intervalCallback())) {
                    break;
                }
            }
        }
        return result;
    }


    public getLaunchCommand(
        gamePath: string,
        iwad: string,
        pwads: string[],
        debugPort: number,
        map?: string,
        gameIniPath?: string,
        gameArgs?: string[],
        cwd?: string,
    ): LaunchCommand {
        let args = [
            '-iwad',
            iwad,
            '-debug',
            debugPort.toString(),
        ];
        for (const pwad of pwads) {
            args.push('-file', pwad);
        }
        if (gameIniPath) {
            args.push('-config', gameIniPath);
        }
        if (map) {
            args.push('+map', map);
        }
        if (gameArgs) {
            args.push(...gameArgs);
        }
        return {
            command: gamePath,
            args: args,
            cwd: cwd,
        };
    }


    async runLauncher(
        launcherCommand: LaunchCommand,
        portToCheck: number,
        cancellationToken: CancellationToken | undefined
    ): Promise<DebugLaunchState> {
        await this.tearDownAfterDebug();
        if (!cancellationToken) {
            this.cancellationTokenSource = new CancellationTokenSource();
            cancellationToken = this.cancellationTokenSource.token;
        }
        const cmd = launcherCommand.command;
        // get the file name from the command
        this.gameName = path.basename(cmd);
        if (this.gameName.endsWith('.exe')) {
            this.gameName = this.gameName.slice(0, -4);
        }
        const args = launcherCommand.args;
        const port = portToCheck;
        let _output: string = '';
        let _stdOut: string = '';
        let _stdErr: string = '';
        this.launcherProcess = spawn(cmd, args, {
            cwd: launcherCommand.cwd,
        });
        let gameIsRunning = true;
        let errorOccured = false;
        let exitCode: number | null = null;
        this.launcherProcess.on('close', (code) => {
            gameIsRunning = false;
            errorOccured = true;
            exitCode = code;
        });
        this.launcherProcess.on('error', (error) => {
            console.error(error);
            _stdErr += error.toString();
            _output += error.toString();
            this.errorString = error.toString();
            gameIsRunning = false;
            errorOccured = true;
        });
        this.launcherProcess.stdout?.on('data', (data) => {
            let dataString = data.toString();
            console.log(dataString);
            _stdOut += dataString;
            _output += dataString;
        });
        this.launcherProcess.stderr?.on('data', (data) => {
            let dataString = data.toString();
            console.error(dataString);
            _stdErr += dataString;
            _output += dataString;
        });

        const _processHasExited = () => {
            if (errorOccured || !this.launcherProcess || !this.launcherProcess.stdout || !this.launcherProcess.stderr) {
                return true;
            }
            return false;
        };
        const _checkBad = () => {
            if (_processHasExited()) {
                return true;
            }
            if (cancellationToken.isCancellationRequested) {
                return true;
            }
            return false;
        };
        const _handleBad = async () => {
            this.removeProcessListeners();
            if (_processHasExited()) {
                window.showErrorMessage(
                    `Launcher process exited with error code ${this.launcherProcess?.exitCode || exitCode || -1
                    }.\ncmd: ${cmd}\nargs: ${args.join(' ')}\noutput: ${_output}`
                );
                return DebugLaunchState.launcherError;
            }
            if (cancellationToken.isCancellationRequested) {
                await this.tearDownAfterDebug();
                return DebugLaunchState.cancelled;
            }
            return DebugLaunchState.gameFailedToStart;
        };
        if (_checkBad()) {
            return await _handleBad();
        }
        const GameStartTimeout = 15000;
        // get the current system time
        gameIsRunning = await this.waitForGameToStart(GameStartTimeout, () => {
            return !_checkBad();
        });
        if (!gameIsRunning || _checkBad()) {
            return await _handleBad();
        }
        // we can't get the PID of the game from the launcher process because
        // both MO2 and the script extender loaders fork and deatch the game process
        const gamePIDs = await this.getGamePIDs();
        if (gamePIDs.length === 0) {
            return await _handleBad();
        }
        if (gamePIDs.length > 1) {
            return DebugLaunchState.multipleGamesRunning;
        }
        this.gamePID = gamePIDs[0];

        // game has launched, now we wait for the port to open
        const connectionTimeout = 15000;
        let result = false;
        result = await this.waitForPort(port, connectionTimeout, async () => {
            if (cancellationToken.isCancellationRequested) {
                return false;
            }
            gameIsRunning = await this.getGameIsRunning();
            return gameIsRunning;
        });
        if (!gameIsRunning || _checkBad()) {
            return await _handleBad();
        }
        return result ? DebugLaunchState.success : DebugLaunchState.gameFailedToStart;
    }
}
