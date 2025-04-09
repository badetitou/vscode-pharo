import { ExtensionContext, scm, SourceControl, Uri, QuickDiffProvider, CancellationToken, ProviderResult } from 'vscode';
import { Disposable, LanguageClient } from 'vscode-languageclient/node';
import { IDisposable } from '../util';

export class IceRepository {
    public sourceControl: SourceControl;

    constructor(public name: string, public valid: boolean) {}
}

class IceQuickDiffProvider implements QuickDiffProvider {
    constructor(private client: LanguageClient) {}

    provideOriginalResource(uri: Uri, token: CancellationToken): ProviderResult<Uri> {
        // Implémentez la logique pour fournir l'URI de la ressource originale
        return this.client.sendRequest('pls-ice:originalResource', { uri: uri.toString() }).then((originalUri: string) => {
            return Uri.parse(originalUri, true);
        });
    }
}

export class IceControlManager implements IDisposable {

    disposables: Disposable[] = [];
    ices: IceRepository[] = [];

    dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    constructor(private _client: LanguageClient, private _context: ExtensionContext) {
        this._client.start().then(() => {
            this._client.sendRequest('pls-ice:repositories').then((param: IceRepository[]) => this.onGetRepositories(param));
        });		
    }

    private onGetRepositories(repositories: IceRepository[]) {
        const quickDiffProvider = new IceQuickDiffProvider(this._client);

        repositories.forEach((repository) => {
            let iceRepo = new IceRepository(repository.name, repository.valid);
            if (iceRepo.valid) {
                iceRepo.sourceControl = scm.createSourceControl('pls', repository.name);
                iceRepo.sourceControl.quickDiffProvider = quickDiffProvider;
                this.ices.push(iceRepo); 
            }
        });
        this.ices.forEach(ice => {
            if(ice.valid) {
                this._context.subscriptions.push(ice.sourceControl);
                ice.sourceControl.count = 0;
                this.resolveWorkingCopyOf(ice);
            }
        });
    }

    private resolveWorkingCopyOf(ice: IceRepository) {
        this._client.sendRequest('pls-ice:repository', {'aRepositoryName': ice.name}).then((modifiedClasses: string[]) => {
            let icePackageGroup = ice.sourceControl.createResourceGroup('iceWorking', 'Changes');
            this._context.subscriptions.push(icePackageGroup);
            icePackageGroup.resourceStates = modifiedClasses.map((classURI) => {
                return {resourceUri: Uri.parse(classURI, true)}
            });
            
        });
    }
}