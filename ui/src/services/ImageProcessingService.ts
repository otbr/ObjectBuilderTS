/**
 * Image Processing Service
 * High-level API for image processing operations using web workers
 */

import { getWorkerPool } from '../workers/workerPool';
import type { ImageProcessorMessage, ImageProcessorResponse } from '../workers/imageProcessor.worker';

export class ImageProcessingService {
	private workerPool = getWorkerPool();
	private taskIdCounter = 0;

	private generateTaskId(): string {
		return `task_${Date.now()}_${++this.taskIdCounter}`;
	}

	/**
	 * Serialize ImageData for transfer
	 */
	private serializeImageData(imageData: ImageData): any {
		return {
			data: Array.from(imageData.data),
			width: imageData.width,
			height: imageData.height,
		};
	}

	/**
	 * Deserialize ImageData from transfer
	 */
	private deserializeImageData(serialized: any): ImageData {
		const data = new Uint8ClampedArray(serialized.data);
		return new ImageData(data, serialized.width, serialized.height);
	}

	/**
	 * Cut frames from an image
	 */
	async cutFrames(
		imageData: ImageData,
		offsetX: number,
		offsetY: number,
		frameWidth: number,
		frameHeight: number,
		columns: number,
		rows: number
	): Promise<ImageData[]> {
		const message: ImageProcessorMessage = {
			id: this.generateTaskId(),
			type: 'cutFrames',
			data: {
				imageData: this.serializeImageData(imageData),
				offsetX,
				offsetY,
				frameWidth,
				frameHeight,
				columns,
				rows,
			},
		};

		const response = await this.workerPool.execute(message);
		if (!response.success || !response.data) {
			throw new Error(response.error || 'Failed to cut frames');
		}

		// Deserialize results
		const serializedResults = response.data as any[];
		return serializedResults.map(serialized => this.deserializeImageData(serialized));
	}

	/**
	 * Rotate an image
	 */
	async rotateImage(imageData: ImageData, degrees: number): Promise<ImageData> {
		const message: ImageProcessorMessage = {
			id: this.generateTaskId(),
			type: 'rotateImage',
			data: {
				imageData: this.serializeImageData(imageData),
				degrees,
			},
		};

		const response = await this.workerPool.execute(message);
		if (!response.success || !response.data) {
			throw new Error(response.error || 'Failed to rotate image');
		}

		return this.deserializeImageData(response.data);
	}

	/**
	 * Flip an image
	 */
	async flipImage(
		imageData: ImageData,
		horizontal: boolean,
		vertical: boolean
	): Promise<ImageData> {
		const message: ImageProcessorMessage = {
			id: this.generateTaskId(),
			type: 'flipImage',
			data: {
				imageData: this.serializeImageData(imageData),
				horizontal,
				vertical,
			},
		};

		const response = await this.workerPool.execute(message);
		if (!response.success || !response.data) {
			throw new Error(response.error || 'Failed to flip image');
		}

		return this.deserializeImageData(response.data);
	}

	/**
	 * Process pixels with a specific operation
	 */
	async processPixels(
		imageData: ImageData,
		operation: string,
		params?: any
	): Promise<ImageData> {
		const message: ImageProcessorMessage = {
			id: this.generateTaskId(),
			type: 'processPixels',
			data: {
				imageData: this.serializeImageData(imageData),
				operation,
				params: params || {},
			},
		};

		const response = await this.workerPool.execute(message);
		if (!response.success || !response.data) {
			throw new Error(response.error || 'Failed to process pixels');
		}

		return this.deserializeImageData(response.data);
	}

	/**
	 * Get worker pool statistics
	 */
	getStats() {
		return this.workerPool.getStats();
	}
}

// Singleton instance
let imageProcessingServiceInstance: ImageProcessingService | null = null;

export function getImageProcessingService(): ImageProcessingService {
	if (!imageProcessingServiceInstance) {
		imageProcessingServiceInstance = new ImageProcessingService();
	}
	return imageProcessingServiceInstance;
}

