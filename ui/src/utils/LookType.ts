/**
 * LookType utility class for generating character look XML
 * Based on BindableLookType from ActionScript version
 */

export class LookType {
	public outfit: number = 0;
	public item: number = 0;
	public head: number = 0;
	public body: number = 0;
	public legs: number = 0;
	public feet: number = 0;
	public addons: number = 0;
	public mount: number = 0;
	public corpse: number = 0;

	public serialize(): string | null {
		// Create XML string
		let xml = '<look';
		
		if (this.outfit !== 0) {
			xml += ` type="${this.outfit}"`;
		} else if (this.item !== 0) {
			xml += ` typeex="${this.item}"`;
		} else {
			return null; // Need either outfit or item
		}

		if (this.head !== 0) xml += ` head="${this.head}"`;
		if (this.body !== 0) xml += ` body="${this.body}"`;
		if (this.legs !== 0) xml += ` legs="${this.legs}"`;
		if (this.feet !== 0) xml += ` feet="${this.feet}"`;
		if (this.mount !== 0) xml += ` mount="${this.mount}"`;
		if (this.addons !== 0) xml += ` addons="${this.addons}"`;
		if (this.corpse !== 0) xml += ` corpse="${this.corpse}"`;
		
		xml += '/>';
		return xml;
	}

	public unserialize(xmlString: string): void {
		// Parse XML string
		const parser = new DOMParser();
		const doc = parser.parseFromString(xmlString, 'text/xml');
		
		const lookElement = doc.querySelector('look');
		if (!lookElement) {
			throw new Error('Invalid look XML. Missing look tag.');
		}

		this.clear();

		const type = lookElement.getAttribute('type');
		const typeex = lookElement.getAttribute('typeex');
		
		if (type) {
			this.outfit = parseInt(type, 10) || 0;
		} else if (typeex) {
			this.item = parseInt(typeex, 10) || 0;
		} else {
			throw new Error('Invalid look XML. Missing look type/typeex.');
		}

		const head = lookElement.getAttribute('head');
		const body = lookElement.getAttribute('body');
		const legs = lookElement.getAttribute('legs');
		const feet = lookElement.getAttribute('feet');
		const addons = lookElement.getAttribute('addons');
		const mount = lookElement.getAttribute('mount');
		const corpse = lookElement.getAttribute('corpse');

		if (head) this.head = parseInt(head, 10) || 0;
		if (body) this.body = parseInt(body, 10) || 0;
		if (legs) this.legs = parseInt(legs, 10) || 0;
		if (feet) this.feet = parseInt(feet, 10) || 0;
		if (addons) this.addons = parseInt(addons, 10) || 0;
		if (mount) this.mount = parseInt(mount, 10) || 0;
		if (corpse) this.corpse = parseInt(corpse, 10) || 0;
	}

	public clear(): void {
		this.outfit = 0;
		this.item = 0;
		this.head = 0;
		this.body = 0;
		this.legs = 0;
		this.feet = 0;
		this.addons = 0;
		this.mount = 0;
		this.corpse = 0;
	}
}

