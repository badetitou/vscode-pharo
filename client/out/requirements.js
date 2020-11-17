"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRequirements = void 0;
const vscode = require('vscode');
async function resolveRequirements() {
    const pathToVM = await checkPathToVM();
    const pathToImage = await checkPathToImage();
    return Promise.resolve({ pathToVM: pathToVM, pathToImage: pathToImage });
}
exports.resolveRequirements = resolveRequirements;
async function checkPathToVM() {
    return new Promise(async (resolve, reject) => {
        if (vscode.workspace.getConfiguration('pharo').get('pathToVM') === '') {
            reject({
                message: 'Path to VM not set',
                label: 'Open settings',
                command: 'workbench.action.openSettingsJson'
            });
        }
        return resolve(vscode.workspace.getConfiguration('pharo').get('pathToVM'));
    });
}
async function checkPathToImage() {
    return new Promise(async (resolve, reject) => {
        if (vscode.workspace.getConfiguration('pharo').get('pathToImage') === '') {
            reject({
                message: 'Path to Image not set',
                label: 'Open settings',
                command: 'workbench.action.openSettingsJson'
            });
        }
        return resolve(vscode.workspace.getConfiguration('pharo').get('pathToImage'));
    });
}
//# sourceMappingURL=requirements.js.map