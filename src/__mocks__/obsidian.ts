export const App = class App {};
export const ItemView = class ItemView {
	getViewType() { return ''; }
};
export const TFile = class TFile {};
export const View = class View {};
export const Plugin = class Plugin {};
export const Platform = {
	isMobile: false,
};
export const Modal = class Modal {
	app;
	contentEl;
	constructor(app?: unknown) {
		this.app = app;
		this.contentEl = {
			empty() {},
			createEl() { return {}; },
		};
	}
	open() {}
	close() {}
};
export const Setting = class Setting {
	constructor(_containerEl?: unknown) {}
	setName() { return this; }
	setHeading() { return this; }
	setDesc() { return this; }
	addText(cb?: (text: { setPlaceholder: () => unknown; setValue: () => unknown; onChange: () => unknown; }) => void) {
		cb?.({
			setPlaceholder: () => this,
			setValue: () => this,
			onChange: () => this,
		});
		return this;
	}
	addTextArea(cb?: (text: { setValue: () => unknown; onChange: () => unknown; inputEl: { addClass: () => void } }) => void) {
		cb?.({
			setValue: () => this,
			onChange: () => this,
			inputEl: { addClass() {} },
		});
		return this;
	}
	addButton(cb?: (btn: { setButtonText: () => unknown; setCta: () => unknown; onClick: () => unknown }) => void) {
		cb?.({
			setButtonText: () => this,
			setCta: () => this,
			onClick: () => this,
		});
		return this;
	}
	addToggle(cb?: (toggle: { setValue: () => unknown; onChange: () => unknown }) => void) {
		cb?.({
			setValue: () => this,
			onChange: () => this,
		});
		return this;
	}
	addColorPicker(cb?: (color: { setValue: () => unknown; onChange: () => unknown }) => void) {
		cb?.({
			setValue: () => this,
			onChange: () => this,
		});
		return this;
	}
};
export const Menu = class Menu {};
export const MenuItem = class MenuItem {};
export const Notice = class Notice {};
export const TAbstractFile = class TAbstractFile {};
export const CachedMetadata = class CachedMetadata {};
