import { Emitter } from "../IDEInterface"
import { FileSystemProvider, FileStat, FileType, Event, FileChangeEvent, Disposable, Uri } from 'vscode';
import Wad from "../doom-wad/Wad";
import * as fs from 'fs/promises';
import Lump from "../doom-wad/Lumps/Lump";
import { readFileSync } from "fs";
import * as path from "path";

const EXTENSIONS = ['.wad', '.iwad'];
export class WadFileSystemProvider implements FileSystemProvider {
    onDidChangeFile: Event<FileChangeEvent[]> = new Emitter<FileChangeEvent[]>().event;

    // we have to cache the wad files because this is a singleton
    private Wads: Map<string, Wad> = new Map();

    public static CreateWadUri(wadPath: string, entryPath: string): Uri {
        const dspath = encodeURI(`wad://${path.normalize(wadPath)}/${path.normalize(entryPath)}`);
        return Uri.parse(dspath);
    }

    private parseWadUri(uri: Uri): { wadPath: string; entryPath: string } {
        if (!uri.scheme.startsWith('wad')) {
            throw new Error('Invalid WAD URI format');
        }
        const uriString = uri.path;
        // find the last instance of ".wad"
        let wadpos = -1;
        let ext = '';
        for (ext of EXTENSIONS) {
            wadpos = uriString.toLowerCase().lastIndexOf(ext);
            if (wadpos !== -1) {
                break;
            }
        }
        if (wadpos === -1) {
            throw new Error('Invalid WAD URI format');
        }
        const wadPath = uriString.substring(0, wadpos + ext.length);
        const entryPath = uriString.substring(wadpos + ext.length + 1);

        if (wadPath.length === 0) {
            throw new Error('Invalid WAD URI format');
        }
        return {
            wadPath: wadPath,
            entryPath: entryPath || ''
        };
    }

    private async getWadFile(wadPath: string): Promise<Wad> {
        if (!this.Wads.has(wadPath)) {
            const wad = new Wad();
            const buffer = readFileSync(wadPath);
            wad.load(buffer.buffer);
            this.Wads.set(wadPath, wad);
        }
        return this.Wads.get(wadPath)!;
    }

    async stat(uri: Uri): Promise<FileStat> {
        const { wadPath, entryPath } = this.parseWadUri(uri);
        if (entryPath === '') {
            return {
                type: FileType.Directory,
                ctime: 0,
                mtime: 0,
                size: 0
            };
        }
        const wad = await this.getWadFile(wadPath);
        const entry = wad.lumps.find(lump => lump.name === entryPath);

        if (!entry) {
            throw new Error(`Entry not found: ${entryPath}`);
        }

        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: entry.length
        };
    }

    async readDirectory(uri: Uri): Promise<[string, FileType][]> {
        const { wadPath } = this.parseWadUri(uri);
        const wad = await this.getWadFile(wadPath);
        return wad.lumps.map(lump => [lump.name, FileType.File]);
    }

    async getEntry(uri: Uri): Promise<Lump> {
        const { wadPath, entryPath } = this.parseWadUri(uri);
        const wad = await this.getWadFile(wadPath);
        const entry = wad.lumps.find(lump => lump.name === entryPath);

        if (!entry) {
            throw new Error(`Entry not found: ${entryPath}`);
        }

        return entry;
    }

    async readFile(uri: Uri): Promise<Uint8Array> {
        const entry = await this.getEntry(uri);
        return new Uint8Array(entry.content);
    }

    async writeFile(uri: Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        const { wadPath, entryPath } = this.parseWadUri(uri);
        const wad = await this.getWadFile(wadPath);
        let entry = wad.lumps.find(lump => lump.name === entryPath);
        if (!entry && !options.create) {
            throw new Error(`Entry not found: ${entryPath}`);
        } else if (entry && !options.overwrite) {
            throw new Error(`Entry already exists: ${entryPath}`);
        }

        if (!entry) {
            entry = new Lump();
            entry.name = entryPath;
            wad.lumps.push(entry);
        }

        entry.content = content;
        await fs.writeFile(wadPath, Buffer.from(wad.save()));
    }

    async delete(uri: Uri, options: { recursive: boolean }): Promise<void> {
        const { wadPath, entryPath } = this.parseWadUri(uri);
        const wad = await this.getWadFile(wadPath);
        wad.lumps = wad.lumps.filter(lump => lump.name !== entryPath);
        await fs.writeFile(wadPath, Buffer.from(wad.save()));
    }

    async rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): Promise<void> {
        const { wadPath, entryPath } = this.parseWadUri(oldUri);
        const wad = await this.getWadFile(wadPath);
        const newEntryPath = this.parseWadUri(newUri).entryPath;
        wad.lumps.find(lump => lump.name === entryPath)!.name = newEntryPath;
        await fs.writeFile(wadPath, Buffer.from(wad.save()));
    }

    async createDirectory(uri: Uri): Promise<void> {
        throw new Error('Creating directories in WAD files is not supported');
    }

    watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): Disposable {
        return new Disposable(() => { });
    }
}

