import { IResourceManager } from './Resources';

/**
 * Simple ResourceManager implementation
 * Provides default English strings for resources
 */
export class ResourceManager implements IResourceManager {
	private static instance: ResourceManager | null = null;

	private constructor() {
		// Private constructor for singleton
	}

	public static getInstance(): ResourceManager {
		if (!ResourceManager.instance) {
			ResourceManager.instance = new ResourceManager();
		}
		return ResourceManager.instance;
	}

	public getString(bundleName: string, resourceName: string, parameters?: any[] | null, locale?: string): string {
		// For now, return default English strings
		// In the future, this could load from localization files
		const defaultStrings: { [key: string]: string } = {
			// Common strings
			'loading': 'Loading...',
			'exportingSprites': 'Exporting sprites...',
			'exportingObjects': 'Exporting objects...',
			'invalidCategory': 'Invalid category',
			'invalidSpriteSize': 'Invalid sprite size',
			'spritesNotLoaded': 'Sprites not loaded',
			'metadataNotLoaded': 'Metadata not loaded',
			'spriteNotFound': 'Sprite not found',
			'thingNotFound': 'Thing not found',
			'indexOutOfRange': 'Index out of range',
			'fileNotFound': 'File not found',
			'failedToGetSprite': 'Failed to get sprite',
			'failedToGetThing': 'Failed to get thing',
			'readUnknownFlag': 'Read unknown flag',
			'spritesLimitReached': 'Sprites limit reached',
			'startingTheOptimization': 'Starting the optimization...',
			'hasingSprites': 'Hashing sprites...',
			'resettingDuplicateSprites': 'Resetting duplicate sprites...',
			'searchingForUnusedSprites': 'Searching for unused sprites...',
			'gettingFreeIds': 'Getting free IDs...',
			'organizingSprites': 'Organizing sprites...',
			'updatingObjects': 'Updating objects...',
			'finalizingTheOptimization': 'Finalizing the optimization...',
			'convertOutfits': 'Converting outfits...',
			'changingDurationsInItems': 'Changing durations in items...',
			'changingDurationsInOutfits': 'Changing durations in outfits...',
			'changingDurationsInEffects': 'Changing durations in effects...',
			// Category names
			'item': 'Item',
			'outfit': 'Outfit',
			'effect': 'Effect',
			'missile': 'Missile',
		};

		// If we have a default string, use it
		if (defaultStrings[resourceName]) {
			let result = defaultStrings[resourceName];
			
			// Replace parameters if provided
			if (parameters && parameters.length > 0) {
				// Simple parameter replacement: {0}, {1}, etc.
				parameters.forEach((param, index) => {
					result = result.replace(`{${index}}`, String(param));
				});
			}
			
			return result;
		}

		// Fallback: return resource name or formatted string
		if (parameters && parameters.length > 0) {
			return `${resourceName}(${parameters.join(', ')})`;
		}
		
		return resourceName;
	}
}

