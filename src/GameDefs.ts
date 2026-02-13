import path, { FormatInputPathObject } from "path";
import fs from "fs";
export const DEFAULT_PORT = 19021;


const GAME_SEARCH_PATHS = {
    "win32": [
        "C:/Program Files/GZDoom/gzdoom.exe",
        "C:/Program Files (x86)/GZDoom/gzdoom.exe",
        "C:/Program Files/GZDoom/gzdoom.exe",
    ],
    "linux": [
        "/usr/bin/gzdoom",
        "/usr/local/bin/gzdoom",
        "/usr/games/gzdoom",
    ],
    "darwin": [
        "/Applications/GZDoom.app/Contents/MacOS/GZDoom",
        "/Applications/GZDoom.app/Contents/MacOS/gzdoom",
        "/Applications/GZDoom.app/Contents/MacOS/GZDoom.app/Contents/MacOS/GZDoom",
    ],
}

export interface ProjectItem {
    path: string;
    archive: string;
}
export const GAME_NAME = "gzdoom";
export const GAME_LABEL_NAME = "GZDoom";
export const WAD_EXTENSIONS = ['wad', 'zip', 'pk3', 'pk7', 'deh', 'bex', "iwad", "pwad", "ipk3", "ipk7"];

export const BUILTIN_PK3_FILES = [
    "gzdoom.pk3",
    "brightmaps.pk3",
    "lights.pk3",
    "game_support.pk3",
    "game_widescreen_gfx.pk3"
]

export function isBuiltinPK3File(path: string) {
    return BUILTIN_PK3_FILES.some(builtin => path.toLowerCase().trim().endsWith(builtin.toLowerCase()));
}

export function isWad(path: string) {
    return WAD_EXTENSIONS.some(ext => path.endsWith(ext));
}

export function PathIsAbsolute(p: string) {
    return path.isAbsolute(p) || startsWithDriveLetter(p);
}

export function normalizePath(p: string) {
    // basically like path.normalize but always converts \\ to /
    p = p.replace(/\\/g, '/');
    if (!PathIsAbsolute(p)) {
        return p;
    }
    let parts = p.split('/');
    let result: string[] = [];
    let root = p.startsWith("/") ? "/" : "";
    for (let part of parts) {
        if (!part) continue;
        if (part == '.') continue;
        if (part == '..') result.pop();
        else result.push(part);
    }
    return root + result.join('/');
}

export function startsWithDriveLetter(p: string) {
    return /^[A-Za-z]:/.test(p);
}

export function searchForGameBinary(): string | null {
    if (process.platform in GAME_SEARCH_PATHS) {
        for (let p of GAME_SEARCH_PATHS[process.platform]) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
    }
    return null;
}

class gzpath_wrapper implements path.PlatformPath {
    /**
     * Normalize a string path, reducing '..' and '.' parts.
     * When multiple slashes are found, they're replaced by a single one; when the path contains a trailing slash, it is preserved. On Windows, WE STILL USE SLASHES!!!!!!!!
     *
     * @param path string path to normalize.
     * @throws {TypeError} if `path` is not a string.
     */
    normalize(p: string) {
        return normalizePath(p);
    }
    isAbsolute(p: string) {
        return PathIsAbsolute(p);
    }
    isRelative(p: string) {
        return !PathIsAbsolute(p);
    }
    join(...paths: string[]) {
        return normalizePath(path.join(...paths));
    }
    resolve(...paths: string[]) {
        return normalizePath(path.resolve(...paths));
    }
    relative(base: string, p: string) {
        return normalizePath(path.relative(base, p));
    }
    dirname(p: string) {
        return path.dirname(p);
    }
    basename(p: string) {
        return path.basename(p);
    }
    extname(p: string) {
        return path.extname(p);
    }
    sep: '/' | '\\' = '/';
    delimiter: ';' | ':' = path.delimiter;
    parse(p: string) {
        return path.parse(p);
    }
    format(p: FormatInputPathObject) {
        return path.format(p);
    }
    toNamespacedPath(p: string) {
        return path.toNamespacedPath(p);
    }
    get posix() {
        return this;
    }
    get win32() {
        return this;
    }
    // when we need to return paths to the client
    get client() {
        return path;
    }
}
const gzpath = new gzpath_wrapper();
export { gzpath };
