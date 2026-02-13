import { Window } from "./classes/window"
import { EventEmitter } from "events"
import { Monitor } from "./classes/monitor"
import { EmptyMonitor } from "./classes/empty-monitor"
import bindings from "bindings"


function getTryEntry(dirname: string, module_root: string) {
    const path = require("path")
    let relativePath = path.relative(module_root, dirname)
    let parts = relativePath.split(path.sep)
    return ['module_root', ...parts, 'bindings']
}

function getOpts() {
    let opts: any = {
        bindings: "addon.node"
    }
    if (typeof process !== "undefined") {
        const path = require("path")
        const fs = require("fs")
        opts.dirname = path.dirname(__filename)
        opts.module_root = opts.dirname
        while (true) {
            // check if package.json exists
            let packageJsonPath = path.resolve(opts.module_root, "package.json")
            if (fs.existsSync(packageJsonPath)) {
                break
            }
            let newPath = path.resolve(opts.module_root, "..");
            if (newPath === opts.module_root) {
                return null
            }
            opts.module_root = newPath
        }
        opts.try = [
            getTryEntry(opts.dirname, opts.module_root),
            // defaults
            ['module_root', 'build', 'bindings'],
            ['module_root', 'build', 'Debug', 'bindings'],
            ['module_root', 'build', 'Release', 'bindings'],
            ['module_root', 'out', 'Debug', 'bindings'],
            ['module_root', 'Debug', 'bindings'],
            ['module_root', 'out', 'Release', 'bindings'],
            ['module_root', 'Release', 'bindings'],
            ['module_root', 'build', 'default', 'bindings'],
            ['module_root', 'compiled', 'version', 'platform', 'arch', 'bindings'],
            ['module_root', 'addon-build', 'release', 'install-root', 'bindings'],
            ['module_root', 'addon-build', 'debug', 'install-root', 'bindings'],
            ['module_root', 'addon-build', 'default', 'install-root', 'bindings'],
            ['module_root', 'lib', 'binding', 'nodePreGyp', 'bindings'],
        ]
    }
    return opts
}

function require_addon() {
    let opts = getOpts()
    try {
        let addon = bindings(opts)
        if (!addon) {
            // throw new Error("Failed to load addon")
            return null
        }
        return addon
    } catch (e) {
        if (opts.dirname) {
            try {
                const path = require("path")
                let addonPath = path.join(opts.dirname, "addon.node")
                let addon = require(addonPath)
                return addon
            } catch (e) {
                console.error(e)
                return null
            }
        }
        console.error(e)
        return null
    }
}

function get_addon() {
    let addon = require_addon();
    if (!addon) {
        console.error("Failed to load addon, WindowManager will not be available!")
        return null
    }
    return addon
}

const addon = get_addon()

let interval: any = null

let registeredEvents: string[] = []

class WindowManager extends EventEmitter {
    constructor() {
        super()

        let lastId: number

        if (!addon) return

        this.on("newListener", event => {
            if (!addon || !addon.getActiveWindow) return true
            if (event === "window-activated") {
                lastId = addon.getActiveWindow()
            }

            if (registeredEvents.indexOf(event) !== -1) return

            if (event === "window-activated") {
                interval = setInterval(async () => {
                    const win = addon.getActiveWindow()

                    if (lastId !== win) {
                        lastId = win
                        this.emit("window-activated", new Window(win))
                    }
                }, 50)
            } else {
                return
            }

            registeredEvents.push(event)
        })

        this.on("removeListener", event => {
            if (this.listenerCount(event) > 0) return

            if (event === "window-activated") {
                clearInterval(interval)
            }

            registeredEvents = registeredEvents.filter(x => x !== event)
        })
    }

    requestAccessibility = () => {
        if (!addon || !addon.requestAccessibility) return true
        return addon.requestAccessibility()
    }

    getActiveWindow = () => {
        if (!addon) return
        return new Window(addon.getActiveWindow())
    }

    getWindows = (): Window[] => {
        if (!addon || !addon.getWindows) return []
        return addon
            .getWindows()
            .map((win: any) => new Window(win))
            .filter((x: Window) => x.isWindow())
    }

    getMonitors = (): Monitor[] => {
        if (!addon || !addon.getMonitors) return []
        return addon.getMonitors().map((mon: any) => new Monitor(mon))
    }

    getPrimaryMonitor = (): Monitor | EmptyMonitor => {
        if (process.platform === "win32") {
            return this.getMonitors().find(x => x.isPrimary) || new EmptyMonitor()
        } else {
            return new EmptyMonitor()
        }
    }

    createProcess = (path: string, cmd = ""): number => {
        if (!addon || !addon.createProcess) return 0
        return addon.createProcess(path, cmd)
    }

    hideInstantly = (handle: Buffer) => {
        if (!addon || !addon.hideInstantly) return
        let handleNumber = handle.readUInt32LE(0)
        return addon.hideInstantly(handleNumber)
    }

    forceWindowPaint = (handle: Buffer) => {
        if (!addon || !addon.forceWindowPaint) return
        let handleNumber = handle.readUInt32LE(0)
        return addon.forceWindowPaint(handleNumber)
    }

    setWindowAsPopup = (handle: Buffer) => {
        if (!addon || !addon.setWindowAsPopup) return
        let handleNumber = handle.readUInt32LE(0)
        return addon.setWindowAsPopup(handleNumber)
    }

    setWindowAsPopupWithRoundedCorners = (handle: Buffer) => {
        if (!addon || !addon.setWindowAsPopup) return
        let handleNumber = handle.readUInt32LE(0)
        return addon.setWindowAsPopupWithRoundedCorners(handleNumber)
    }

    showInstantly = (handle: Buffer) => {
        if (!addon || !addon.showInstantly) return
        let handleNumber = handle.readUInt32LE(0)
        return addon.showInstantly(handleNumber)
    }
}

const windowManager = new WindowManager()

export { windowManager, Window, addon }
