export interface IResourceManager {
    getString(bundleName: string, resourceName: string, parameters?: any[] | null, locale?: string): string;
}

export class Resources {
    public static manager: IResourceManager | null = null;
    public static bundleName: string = "strings";
    public static locale: string = "en_US";

    private constructor() {
        throw new Error("Resources is a static class and cannot be instantiated");
    }

    public static getString(resourceName: string, ...rest: any[]): string {
        if (!Resources.manager) {
            // Try to initialize if not already done (defensive fallback)
            try {
                const { ResourceManager } = require("./ResourceManager");
                Resources.manager = ResourceManager.getInstance();
            } catch (error) {
                // If initialization fails, return a fallback string
                console.warn(`Resource manager not initialized, using fallback for: ${resourceName}`);
                return resourceName;
            }
        }

        // At this point, manager should be initialized, but TypeScript needs a check
        if (!Resources.manager) {
            return resourceName; // Final fallback
        }

        const parameters = rest.length === 0 ? null : rest;
        return Resources.manager.getString(Resources.bundleName, resourceName, parameters, Resources.locale);
    }
}

