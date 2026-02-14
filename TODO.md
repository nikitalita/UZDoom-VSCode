## WindowManager
WindowManager is a library that we use to bring the game window to the foreground when continuing.
The CI only runs on Windows, so re-focusing after continuing the game only works on Windows from the CI.
Need to publish per-platform versions of the extension.

## Publishing
The extension will be published under the identifier "\<package.json:publisher\>.\<package.json:name\>". This is currently set to "UZDoom.uzdoom-vscode".

The publish step on the CI (when you uncomment it) will automatically run and publish to the vscode store whenever you tag a new release (ensure that the tag is in semver format starting with the letter 'v'). 

- [ ] Create an account on Visual Studio Marketplace (https://marketplace.visualstudio.com/manage/publishers/)
- [ ] Add token to the repository secrets under the name VSCE_TOKEN
- [ ] Uncomment the publish step in the build workflow
- [ ] Publish the extension to the Visual Studio Marketplace
- [ ] Publish the extension to the Open VSX Registry

