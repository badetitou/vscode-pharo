import { ExtensionContext, scm, SourceControl, Uri } from 'vscode';
import { Disposable, LanguageClient } from 'vscode-languageclient/node';
import { IDisposable } from '../util';

export class IceRepository {
	public sourceControl: SourceControl;

	constructor(public name: string, public valid: boolean) {}
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
		repositories.forEach((repository) => {
			let iceRepo = new IceRepository(repository.name, repository.valid);
			if (iceRepo.valid) {
				iceRepo.sourceControl = scm.createSourceControl(repository.name, repository.name);
				this.ices.push(iceRepo); 
			}
		})
		this.ices.forEach(ice => {
			if(ice.valid) {
				this._context.subscriptions.push(ice.sourceControl)
				ice.sourceControl.count = 0;
				this.resolveWorkingCopyOf(ice);
			}
		});
		
	}

	private resolveWorkingCopyOf(ice: IceRepository) {
		
		this._client.sendRequest('pls-ice:repository', {'aRepositoryName': ice.name}).then((modifiedClasses: string[]) => {
			let icePackageGroup = ice.sourceControl.createResourceGroup('workingTree', 'Changes');
			// icePackageGroup.hideWhenEmpty = true;
			this._context.subscriptions.push(icePackageGroup);
			modifiedClasses.forEach((classURI) => {
				icePackageGroup.resourceStates = [
					{
						resourceUri: Uri.parse(classURI, true)
					}
				]
			})
		})
	}
	
}