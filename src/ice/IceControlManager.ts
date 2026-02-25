import {
    CancellationToken,
    commands,
    Disposable,
    ProviderResult,
    QuickDiffProvider,
    scm,
    SourceControl,
    SourceControlResourceGroup,
    SourceControlResourceState,
    TextDocument,
    Uri,
    window,
    workspace
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { IDisposable } from '../util';

export class IceRepository {
    public sourceControl?: SourceControl;
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
                this.sourceControlIdFrom(repository.name),
                repository.name
            );
            sourceControl.quickDiffProvider = this.quickDiffProvider;
            iceRepository.sourceControl = sourceControl;
            iceRepository.changesGroup = sourceControl.createResourceGroup('iceWorking', 'Changes');
            sourceControl.count = 0;
            this.repositories.set(repository.name, iceRepository);
        });
    }

    private async resolveWorkingCopyOf(ice: IceRepository): Promise<void> {
        if (!ice.sourceControl || !ice.changesGroup) {
            return;
        }

        try {
            const modifiedClasses = await this._client.sendRequest(
                'pls-ice:repository',
                { 'aRepositoryName': ice.name }
            ) as string[];
            const uniqueClassUris = Array.from(new Set(modifiedClasses));
            const states: SourceControlResourceState[] = uniqueClassUris.map((classURI) => {
                const resourceUri = Uri.parse(classURI, true);
                return {
                    resourceUri,
                    command: {
                        command: 'vscode.open',
                        title: 'Open Changes',
                        arguments: [resourceUri]
                    }
                };
            });
            ice.changesGroup.resourceStates = states;
            ice.sourceControl.count = states.length;
        } catch (error) {
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

    private sourceControlIdFrom(repositoryName: string): string {
        return `pls.${repositoryName.toLowerCase().replace(/[^a-z0-9_.-]/g, '-')}`;
    }
}
