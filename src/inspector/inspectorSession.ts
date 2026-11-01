import {
	InspectedObject,
	InspectorItem,
	InspectorPage,
	InspectorView,
	expectInspectedObject,
	expectInspectorPage,
	expectInspectorView
} from './inspectorContracts';

// The pages of the Inspector view, as Pulsar's inspector shows them: inspecting an item of a page opens a page on it,
// and going back closes the last page. The image keeps every object the client was given a reference to until the client
// releases it, so a page releases the references it received when it closes or shows another view.

export type InspectorRequest = (method: string, params: unknown) => Promise<unknown>;

/** Number of items a view or an item answers at once; the view offers to show the next ones. */
export const INSPECTOR_PAGE_SIZE = 100;

export interface InspectorPageState {
	/** Serial number of the page, unique in the session, so that the ids of its tree items are. */
	readonly serial: number;
	/** Label of the page in the breadcrumb: the expression, or the name of the item it inspects. */
	readonly label: string;
	object: InspectedObject;
	viewId: string;
	view?: InspectorView;
	/** Children shown so far of the items expanded in the view, by reference. */
	readonly children: Map<string, InspectorPage>;
	/** Whether the page received the reference of its object, and releases it when it closes. */
	readonly ownsObject: boolean;
	/** References the view and the expanded items received, released when the page closes or shows another view. */
	readonly refs: Set<string>;
}

export class InspectorSession {

	private readonly stack: InspectorPageState[] = [];
	private serial = 0;

	constructor(private readonly request: InspectorRequest) {}

	get pages(): readonly InspectorPageState[] {
		return this.stack;
	}

	get current(): InspectorPageState | undefined {
		return this.stack[this.stack.length - 1];
	}

	/** Evaluate expression, with self bound to the object of the reference receiver when given, else in the context of the document. */
	async evaluate(expression: string, context: { textDocumentURI?: unknown; receiver?: string }): Promise<InspectedObject> {
		return expectInspectedObject(
			await this.request('pls-inspector:evaluate', { expression, textDocumentURI: context.textDocumentURI, receiver: context.receiver }),
			'pls-inspector:evaluate'
		);
	}

	async describe(ref: string): Promise<InspectedObject> {
		return expectInspectedObject(await this.request('pls-inspector:inspect', { ref }), 'pls-inspector:inspect');
	}

	/** Close every page and open one on object, which the page owns when ownsObject is true. */
	async open(object: InspectedObject, label: string, ownsObject: boolean): Promise<InspectorPageState> {
		// The closed pages may hold the reference of object, which the new page then keeps instead of releasing it.
		const refs = this.stack.splice(0).flatMap((page) => this.refsOf(page));
		await this.release(refs.filter((ref) => ref !== object.ref));
		return this.push(object, label, ownsObject || refs.includes(object.ref));
	}

	/** Open a page on the object of an item of the current page, which keeps owning its reference. */
	async dive(item: InspectorItem): Promise<InspectorPageState> {
		return this.push(await this.describe(item.ref), item.name, false);
	}

	/** Open a page on object, the result of an evaluation, which the page owns. */
	async push(object: InspectedObject, label: string, ownsObject: boolean): Promise<InspectorPageState> {
		const page: InspectorPageState = {
			serial: ++this.serial,
			label,
			object,
			viewId: object.views[0]?.id ?? 'raw',
			children: new Map(),
			ownsObject,
			refs: new Set()
		};
		this.stack.push(page);
		await this.loadView(page);
		return page;
	}

	/** Close the pages above the index-th one. */
	async backTo(index: number): Promise<void> {
		const closed = this.stack.splice(Math.max(index + 1, 0));
		await this.release(closed.flatMap((page) => this.refsOf(page)));
	}

	async back(): Promise<void> {
		await this.backTo(this.stack.length - 2);
	}

	async closeAll(): Promise<void> {
		await this.backTo(-1);
	}

	async selectView(viewId: string): Promise<void> {
		const page = this.current;
		if (!page || !page.object.views.some((view) => view.id === viewId)) {
			return;
		}
		page.viewId = viewId;
		await this.loadView(page);
	}

	/** Describe the object of the current page again and reload its view, which shows the current state of the object. */
	async refresh(): Promise<void> {
		const page = this.current;
		if (!page) {
			return;
		}
		page.object = await this.describe(page.object.ref);
		if (!page.object.views.some((view) => view.id === page.viewId)) {
			page.viewId = page.object.views[0]?.id ?? 'raw';
		}
		await this.loadView(page);
	}

	/** Show the next items of the view of the current page. */
	async loadMoreItems(): Promise<void> {
		const page = this.current;
		const view = page?.view;
		if (!page || !view || (view.kind !== 'tree' && view.kind !== 'table')) {
			return;
		}
		const next = expectInspectorView(
			await this.request('pls-inspector:view', { ref: page.object.ref, view: page.viewId, offset: view.items.length, limit: INSPECTOR_PAGE_SIZE }),
			'pls-inspector:view'
		);
		if (next.kind === view.kind) {
			this.own(page, next.items);
			view.items.push(...next.items);
			view.total = next.total;
		}
	}

	/** Answer the children of an item of the current page shown so far, asking the image for the first or the next ones. */
	async childrenOf(item: InspectorItem, more = false): Promise<InspectorPage> {
		const page = this.current;
		if (!page) {
			return { items: [], total: 0 };
		}
		const known = page.children.get(item.ref);
		if (known && !more) {
			return known;
		}
		const next = expectInspectorPage(
			await this.request('pls-inspector:children', { ref: item.ref, offset: known?.items.length ?? 0, limit: INSPECTOR_PAGE_SIZE }),
			'pls-inspector:children'
		);
		this.own(page, next.items);
		const children = { items: [...(known?.items ?? []), ...next.items], total: next.total };
		page.children.set(item.ref, children);
		return children;
	}

	private async loadView(page: InspectorPageState): Promise<void> {
		const previous = [...page.refs];
		page.refs.clear();
		page.children.clear();
		page.view = undefined;
		await this.release(previous);
		const view = expectInspectorView(
			await this.request('pls-inspector:view', { ref: page.object.ref, view: page.viewId, offset: 0, limit: INSPECTOR_PAGE_SIZE }),
			'pls-inspector:view'
		);
		if (view.kind === 'tree' || view.kind === 'table') {
			this.own(page, view.items);
		}
		page.view = view;
	}

	private own(page: InspectorPageState, items: readonly InspectorItem[]): void {
		for (const item of items) {
			page.refs.add(item.ref);
		}
	}

	private refsOf(page: InspectorPageState): string[] {
		return page.ownsObject ? [page.object.ref, ...page.refs] : [...page.refs];
	}

	private async release(refs: string[]): Promise<void> {
		if (refs.length > 0) {
			// The image collects nothing more when the release fails, which must not prevent closing the page.
			await this.request('pls-inspector:release', { refs }).catch(() => undefined);
		}
	}
}
