/**
 * A workspace folder is one of potentially many roots opened by the editor. All workspace folders
 * are equal which means there is no notion of an active or primary workspace folder.
 */
export interface WorkspaceFolder {

    /**
     * The associated uri for this workspace folder.
     *
     * *Note:* The {@link Uri}-type was intentionally chosen such that future releases of the editor can support
     * workspace folders that are not stored on the local disk, e.g. `ftp://server/workspaces/foo`.
     */
    readonly uri: Uri;

    /**
     * The name of this workspace folder. Defaults to
     * the basename of its {@link Uri.path uri-path}
     */
    readonly name: string;

    /**
     * The ordinal number of this workspace folder.
     */
    readonly index: number;
}

export enum FileType {
    /**
     * The file type is unknown.
     */
    Unknown = 0,
    /**
     * A regular file.
     */
    File = 1,
    /**
     * A directory.
     */
    Directory = 2,
    /**
     * A symbolic link to a file.
     */
    SymbolicLink = 64
}


export interface Event<T> {
    /**
     * A function that represents an event to which you subscribe by calling it with
     * a listener function as argument.
     *
     * @param listener The listener function will be called when the event happens.
     * @param thisArgs The `this`-argument which will be used when calling the event listener.
     * @param disposables An array to which a {@link Disposable} will be added.
     * @returns A disposable which unsubscribes the event listener.
     */
    (listener: (e: T) => any, thisArgs?: any, disposables?: any[]): any;
}

export interface EventEmitter<T> {
    /**
     * The event listeners can subscribe to.
     */
    event: Event<T>;

    /**
     * Notify all subscribers of the {@link EventEmitter.event event}. Failure
     * of one or more listener will not fail this function call.
     *
     * @param data The event object.
     */
    fire(data: T): void;

    /**
     * Dispose this object and free resources.
     */
    dispose(): void;
}

export interface Uri {

    /**
     * Scheme is the `http` part of `http://www.example.com/some/path?query#fragment`.
     * The part before the first colon.
     */
    readonly scheme: string;

    /**
     * Authority is the `www.example.com` part of `http://www.example.com/some/path?query#fragment`.
     * The part between the first double slashes and the next slash.
     */
    readonly authority: string;

    /**
     * Path is the `/some/path` part of `http://www.example.com/some/path?query#fragment`.
     */
    readonly path: string;

    /**
     * Query is the `query` part of `http://www.example.com/some/path?query#fragment`.
     */
    readonly query: string;

    /**
     * Fragment is the `fragment` part of `http://www.example.com/some/path?query#fragment`.
     */
    readonly fragment: string;

    /**
     * The string representing the corresponding file system path of this Uri.
     *
     * Will handle UNC paths and normalize windows drive letters to lower-case. Also
     * uses the platform specific path separator.
     *
     * * Will *not* validate the path for invalid characters and semantics.
     * * Will *not* look at the scheme of this Uri.
     * * The resulting string shall *not* be used for display purposes but
     * for disk operations, like `readFile` et al.
     *
     * The *difference* to the {@linkcode Uri.path path}-property is the use of the platform specific
     * path separator and the handling of UNC paths. The sample below outlines the difference:
     * ```ts
     * const u = URI.parse('file://server/c$/folder/file.txt')
     * u.authority === 'server'
     * u.path === '/c$/folder/file.txt'
     * u.fsPath === '\\server\c$\folder\file.txt'
     * ```
     */
    readonly fsPath: string;

}


export interface FileAccessorBase {
    isWindows: boolean;
    isDirectory(path: string): Promise<boolean>;
    isFile(path: string): Promise<boolean>;
    findFiles(include: string, exclude: string, maxResults: number, absolute?: boolean, roots?: string[]): Promise<string[]>;
    readDirectory(path: string): Promise<[string, FileType][]>;
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, contents: Uint8Array): Promise<void>;
}

export abstract class FileAccessor implements FileAccessorBase {
    abstract isWindows: boolean;
    abstract isDirectory(path: string): Promise<boolean>;
    abstract isFile(path: string): Promise<boolean>;
    abstract findFiles(include: string, exclude: string, maxResults: number, absolute?: boolean, roots?: string[]): Promise<string[]>;
    abstract readDirectory(path: string): Promise<[string, FileType][]>;
    abstract readFile(path: string): Promise<Uint8Array>;
    abstract writeFile(path: string, contents: Uint8Array): Promise<void>;
    constructor() { }
}

export interface Disposable {
    dispose(): void;
}



export class Emitter<T> implements EventEmitter<T> {
    private _events: Event<T>[] = [];
    private _listeners: ((e: T) => void)[] = [];
    private _thises: any[] = [];
    private _once_listeners: ((e: T) => void)[] = [];
    private _once_thises: any[] = [];

    get event(): Event<T> {
        const new_event = (listener: (e: T) => any, thisArg?: any) => {
            this._listeners.push(listener);
            if (thisArg !== undefined) {
                this._thises.push(thisArg);
            }

            const result: Disposable = {
                dispose: () => {
                    // this._listener = undefined;
                    this._listeners = this._listeners.filter(l => l !== listener);
                    if (thisArg !== undefined) {
                        this._thises = this._thises.filter(t => t !== thisArg);
                    }
                },
            };
            return result;
        };
        this._events.push(new_event);

        return new_event;
    }

    get once(): Event<T> {
        const new_event = (listener: (e: T) => any, thisArg?: any) => {
            this._once_listeners.push(listener);
            if (thisArg !== undefined) {
                this._once_thises.push(thisArg);
            }

            const result: Disposable = {
                dispose: () => {
                    // this._listener = undefined;
                    this._once_listeners = this._once_listeners.filter(l => l !== listener);
                    if (thisArg !== undefined) {
                        this._once_thises = this._once_thises.filter(t => t !== thisArg);
                    }
                },
            };
            return result;
        };
        this._events.push(new_event);

        return new_event;
    }


    fire(event: T): void {
        for (let i = 0; i < this._listeners.length; i++) {
            try {
                this._listeners[i].call(this._thises[i], event);
            } catch (e) {
                console.error(e);
            }
        }
        for (let i = 0; i < this._once_listeners.length; i++) {
            try {
                this._once_listeners[i].call(this._once_thises[i], event);
            } catch (e) {
                console.error(e);
            }
        }
        this._once_listeners = [];
        this._once_thises = [];
    }

    hasListener(): boolean {
        return this._listeners.length > 0 || this._once_listeners.length > 0;
    }

    dispose() {
        this._events = [];
        this._listeners = [];
        this._thises = [];
        this._once_listeners = [];
        this._once_thises = [];
    }
}
