import {
    CancellationToken,
    Command,
    commands,
    Disposable,
    ProviderResult,
    QuickDiffProvider,
    scm,
    SourceControl,
    SourceControlResourceDecorations,
    SourceControlResourceGroup,
    SourceControlResourceState,
    TextDocument,
    Uri,
    window,
    workspace
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { IDisposable } from '../util';

interface IceRepositoryResource {
    uri: string;
    status?: string;
}

interface IceRepositoryStatusResponse {
    changes?: Array<IceRepositoryResource | string>;
    workingChanges?: Array<IceRepositoryResource | string>;
    modifiedChanges?: Array<IceRepositoryResource | string>;
    stagedChanges?: Array<IceRepositoryResource | string>;
    indexChanges?: Array<IceRepositoryResource | string>;
}

interface IceRepositoryState {
    changes: IceRepositoryResource[];
    stagedChanges: IceRepositoryResource[];
}

export class IceRepository {
    public sourceControl?: SourceControl;
    public stagedGroup?: SourceControlResourceGroup;
    public changesGroup?: SourceControlResourceGroup;

    constructor(public name: string, public valid: boolean) {}
}

class IceQuickDiffProvider implements QuickDiffProvider {
    constructor(private client: LanguageClient) {}

    provideOriginalResource(uri: Uri, _token: CancellationToken): ProviderResult<Uri> {
        return this.client
            .sendRequest('pls-ice:originalResource', { uri: uri.toString() })
            .then((originalUri: string) => Uri.parse(originalUri, true))
            .catch(() => undefined);
    }
}

export class IceControlManager implements IDisposable {

    private static readonly SOURCE_CONTROL_ID = 'pharo-iceberg';
    private disposables: Disposable[] = [];
    private repositories = new Map<string, IceRepository>();
    private readonly quickDiffProvider: QuickDiffProvider;
    private refreshing = false;
    private pendingRefresh = false;

    dispose(): void {
        this.repositories.forEach((repository) => {
            repository.sourceControl?.dispose();
        });
        this.disposables.forEach((d) => d.dispose());
    }

    constructor(private _client: LanguageClient) {
        this.quickDiffProvider = new IceQuickDiffProvider(this._client);
        this.disposables.push(
            commands.registerCommand('pharo.ice.refresh', () => this.refresh()),
            commands.registerCommand('pharo.ice.openDiff', (repositoryName: string | undefined, uriOrState: unknown) =>
                this.openDiff(repositoryName, uriOrState)
            ),
            commands.registerCommand('pharo.ice.commit', (repositoryName?: unknown) =>
                this.commit(repositoryName)
            ),
            commands.registerCommand('pharo.ice.push', (repositoryName?: unknown) =>
                this.push(repositoryName)
            ),
            workspace.onDidSaveTextDocument((document) => this.onDidSaveDocument(document))
        );
        void this.refresh();
    }

    async refresh(): Promise<void> {
        if (this.refreshing) {
            this.pendingRefresh = true;
            return;
        }

        this.refreshing = true;
        do {
            this.pendingRefresh = false;
            await this.refreshRepositories();
        } while (this.pendingRefresh);
        this.refreshing = false;
    }

    private async refreshRepositories(): Promise<void> {
        try {
            const repositories = await this._client.sendRequest('pls-ice:repositories') as IceRepository[];
            this.syncRepositories(repositories);
            await Promise.all(
                Array.from(this.repositories.values()).map((repository) =>
                    this.resolveWorkingCopyOf(repository)
                )
            );
        } catch (error) {
            window.showWarningMessage('Unable to refresh Iceberg repositories in VSCode.');
        }
    }

    private syncRepositories(repositories: IceRepository[]): void {
        const nextRepositoryNames = new Set(
            repositories.filter((repository) => repository.valid).map((repository) => repository.name)
        );

        this.repositories.forEach((repository, repositoryName) => {
            if (!nextRepositoryNames.has(repositoryName)) {
                repository.sourceControl?.dispose();
                this.repositories.delete(repositoryName);
            }
        });

        repositories.forEach((repository) => {
            if (!repository.valid) {
                return;
            }

            if (this.repositories.has(repository.name)) {
                return;
            }

            const iceRepository = new IceRepository(repository.name, repository.valid);
            const sourceControl = scm.createSourceControl(
                IceControlManager.SOURCE_CONTROL_ID,
                repository.name
            );
            sourceControl.quickDiffProvider = this.quickDiffProvider;
            sourceControl.acceptInputCommand = {
                command: 'pharo.ice.commit',
                title: 'Commit',
                arguments: [repository.name],
                tooltip: `Commit changes in ${repository.name} with Iceberg`
            };
            sourceControl.statusBarCommands = [
                this.commandForPush(repository.name),
                this.commandForRefresh()
            ];
            sourceControl.inputBox.placeholder = `Commit message for ${repository.name}`;
            iceRepository.sourceControl = sourceControl;
            iceRepository.stagedGroup = sourceControl.createResourceGroup('iceIndex', 'Staged Changes');
            iceRepository.stagedGroup.hideWhenEmpty = true;
            iceRepository.changesGroup = sourceControl.createResourceGroup('iceWorking', 'Changes');
            iceRepository.changesGroup.hideWhenEmpty = true;
            sourceControl.count = 0;
            this.repositories.set(repository.name, iceRepository);
        });
    }

    private async resolveWorkingCopyOf(ice: IceRepository): Promise<void> {
        if (!ice.sourceControl || !ice.changesGroup || !ice.stagedGroup) {
            return;
        }

        try {
            const repositoryState = await this.resolveRepositoryStatusOf(ice.name);
            const stagedStates = this.toSourceControlResourceStates(ice.name, repositoryState.stagedChanges);
            const changedStates = this.toSourceControlResourceStates(ice.name, repositoryState.changes);
            ice.stagedGroup.resourceStates = stagedStates;
            ice.changesGroup.resourceStates = changedStates;
            ice.sourceControl.count = stagedStates.length + changedStates.length;
        } catch (error) {
            ice.stagedGroup.resourceStates = [];
            ice.changesGroup.resourceStates = [];
            ice.sourceControl.count = 0;
        }
    }

    private onDidSaveDocument(document: TextDocument): void {
        if (document.languageId !== 'pharo' && document.uri.scheme !== 'pharoImage') {
            return;
        }
        void this.refresh();
    }

    private async resolveRepositoryStatusOf(repositoryName: string): Promise<IceRepositoryState> {
        try {
            const repositoryStatus = await this._client.sendRequest(
                'pls-ice:repositoryStatus',
                { 'aRepositoryName': repositoryName }
            ) as unknown;
            const parsedStatus = this.parseRepositoryStatusResponse(repositoryStatus);
            if (parsedStatus) {
                return parsedStatus;
            }
        } catch (_error) {
            // Fallback kept for servers that only expose `pls-ice:repository`.
        }

        const modifiedClasses = await this._client.sendRequest(
            'pls-ice:repository',
            { 'aRepositoryName': repositoryName }
        ) as string[];

        return {
            stagedChanges: [],
            changes: Array.from(new Set(modifiedClasses)).map((uri) => ({
                uri,
                status: 'modified'
            }))
        };
    }

    private parseRepositoryStatusResponse(rawStatus: unknown): IceRepositoryState | undefined {
        if (Array.isArray(rawStatus)) {
            return {
                stagedChanges: [],
                changes: this.normalizeResourceList(rawStatus)
            };
        }

        if (!rawStatus || typeof rawStatus !== 'object') {
            return undefined;
        }

        const statusResponse = rawStatus as IceRepositoryStatusResponse;
        const changes = this.normalizeResourceList(
            statusResponse.changes ?? statusResponse.workingChanges ?? statusResponse.modifiedChanges ?? []
        );
        const stagedChanges = this.normalizeResourceList(
            statusResponse.stagedChanges ?? statusResponse.indexChanges ?? []
        );

        return { changes, stagedChanges };
    }

    private normalizeResourceList(rawResources: Array<IceRepositoryResource | string>): IceRepositoryResource[] {
        const uniqueResources = new Map<string, IceRepositoryResource>();
        rawResources.forEach((resource) => {
            if (typeof resource === 'string') {
                uniqueResources.set(resource, { uri: resource, status: 'modified' });
                return;
            }

            if (resource && typeof resource.uri === 'string') {
                uniqueResources.set(resource.uri, {
                    uri: resource.uri,
                    status: this.normalizeStatus(resource.status)
                });
            }
        });
        return Array.from(uniqueResources.values());
    }

    private toSourceControlResourceStates(
        repositoryName: string,
        resources: IceRepositoryResource[]
    ): SourceControlResourceState[] {
        return resources
            .map((resource) => {
                const resourceUri = Uri.parse(resource.uri, true);
                return {
                    resourceUri,
                    command: {
                        command: 'pharo.ice.openDiff',
                        title: 'Open Changes',
                        arguments: [repositoryName, resourceUri.toString()]
                    },
                    decorations: this.decorationsForStatus(resource.status),
                    contextValue: this.contextValueFor(resource.status)
                };
            })
            .sort((left, right) => left.resourceUri.toString().localeCompare(right.resourceUri.toString()));
    }

    private contextValueFor(status?: string): string {
        return `pharo-ice-${this.normalizeStatus(status)}`;
    }

    private decorationsForStatus(status?: string): SourceControlResourceDecorations | undefined {
        switch (this.normalizeStatus(status)) {
            case 'added':
                return { tooltip: 'Added' };
            case 'deleted':
                return { tooltip: 'Deleted', strikeThrough: true };
            case 'untracked':
                return { tooltip: 'Untracked' };
            case 'conflicted':
                return { tooltip: 'Conflict' };
            default:
                return { tooltip: 'Modified' };
        }
    }

    private normalizeStatus(status?: string): string {
        if (!status) {
            return 'modified';
        }

        const normalizedStatus = status.trim().toLowerCase();
        if (normalizedStatus.includes('add')) {
            return 'added';
        }
        if (normalizedStatus.includes('delete') || normalizedStatus.includes('remove')) {
            return 'deleted';
        }
        if (normalizedStatus.includes('untracked') || normalizedStatus.includes('new')) {
            return 'untracked';
        }
        if (normalizedStatus.includes('conflict')) {
            return 'conflicted';
        }
        return 'modified';
    }

    private async openDiff(repositoryName: string | undefined, uriOrState: unknown): Promise<void> {
        const resourceUri = this.resolveUri(uriOrState);
        if (!resourceUri) {
            window.showWarningMessage('Unable to open Iceberg diff: no resource selected.');
            return;
        }

        try {
            const originalUriString = await this._client.sendRequest(
                'pls-ice:originalResource',
                { uri: resourceUri.toString() }
            ) as string | undefined;

            if (!originalUriString) {
                await commands.executeCommand('vscode.open', resourceUri);
                return;
            }

            const originalUri = Uri.parse(originalUriString, true);
            await commands.executeCommand(
                'vscode.diff',
                originalUri,
                resourceUri,
                `${this.displayNameFor(resourceUri)} (${repositoryName ?? 'Iceberg'})`
            );
        } catch (_error) {
            window.showErrorMessage('Unable to open Iceberg diff.');
        }
    }

    private async commit(repositoryName?: unknown): Promise<void> {
        const repository = await this.resolveRepository(repositoryName);
        if (!repository || !repository.sourceControl) {
            return;
        }

        const inputBox = repository.sourceControl.inputBox;
        let message = inputBox.value.trim();
        if (!message) {
            message = (await window.showInputBox({
                title: 'Iceberg Commit',
                placeHolder: `Commit message for ${repository.name}`
            }))?.trim() ?? '';
        }

        if (!message) {
            window.showWarningMessage('Commit cancelled: message is empty.');
            return;
        }

        try {
            const response = await this._client.sendRequest(
                'pls-ice:commit',
                {
                    aRepositoryName: repository.name,
                    message
                }
            ) as string | undefined;
            inputBox.value = '';
            await this.refresh();
            window.showInformationMessage(response && response.length > 0
                ? response
                : `Committed ${repository.name} with Iceberg.`);
        } catch (_error) {
            window.showErrorMessage(`Unable to commit ${repository.name} with Iceberg.`);
        }
    }

    private async push(repositoryName?: unknown): Promise<void> {
        const repository = await this.resolveRepository(repositoryName);
        if (!repository) {
            return;
        }

        try {
            const response = await this._client.sendRequest(
                'pls-ice:push',
                { aRepositoryName: repository.name }
            ) as string | undefined;
            await this.refresh();
            window.showInformationMessage(response && response.length > 0
                ? response
                : `Pushed ${repository.name} with Iceberg.`);
        } catch (_error) {
            window.showErrorMessage(`Unable to push ${repository.name} with Iceberg.`);
        }
    }

    private resolveUri(uriOrState: unknown): Uri | undefined {
        if (typeof uriOrState === 'string') {
            return Uri.parse(uriOrState, true);
        }

        if (uriOrState && typeof uriOrState === 'object') {
            const sourceControlState = uriOrState as Partial<SourceControlResourceState>;
            if (sourceControlState.resourceUri) {
                return sourceControlState.resourceUri;
            }
        }

        return undefined;
    }

    private displayNameFor(uri: Uri): string {
        const segments = uri.path.split('/');
        return segments.length > 0 ? segments[segments.length - 1] : uri.toString();
    }

    private async resolveRepository(repositoryName?: unknown): Promise<IceRepository | undefined> {
        if (typeof repositoryName === 'string') {
            return this.repositories.get(repositoryName);
        }

        if (repositoryName && typeof repositoryName === 'object') {
            const sourceControl = repositoryName as Partial<SourceControl>;
            if (typeof sourceControl.label === 'string') {
                return this.repositories.get(sourceControl.label);
            }
        }

        if (this.repositories.size === 0) {
            window.showWarningMessage('No Iceberg repositories found in the current workspace.');
            return undefined;
        }

        if (this.repositories.size === 1) {
            return Array.from(this.repositories.values())[0];
        }

        const selected = await window.showQuickPick(
            Array.from(this.repositories.keys()).sort((left, right) => left.localeCompare(right)),
            { placeHolder: 'Select an Iceberg repository' }
        );
        return selected ? this.repositories.get(selected) : undefined;
    }

    private commandForPush(repositoryName: string): Command {
        return {
            command: 'pharo.ice.push',
            title: '$(cloud-upload) Push',
            tooltip: `Push ${repositoryName} with Iceberg`,
            arguments: [repositoryName]
        };
    }

    private commandForRefresh(): Command {
        return {
            command: 'pharo.ice.refresh',
            title: '$(refresh) Refresh',
            tooltip: 'Refresh Iceberg repositories'
        };
    }
}
