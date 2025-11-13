/**
 * Image Processing Web Worker
 * Handles computationally intensive image operations off the main thread
 */

export interface ImageProcessorMessage {
	id: string;
	type: 'cutFrames' | 'rotateImage' | 'flipImage' | 'processPixels';
	data: any;
}

export interface ImageProcessorResponse {
	id: string;
	success: boolean;
	data?: any;
	error?: string;
}

// Cut frames from image
function cutFrames(
	imageData: ImageData,
	offsetX: number,
	offsetY: number,
	frameWidth: number,
	frameHeight: number,
	columns: number,
	rows: number
): ImageData[] {
	const frames: ImageData[] = [];
	const sourceData = imageData.data;
	const sourceWidth = imageData.width;
	const sourceHeight = imageData.height;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < columns; c++) {
			const x = offsetX + (c * frameWidth);
			const y = offsetY + (r * frameHeight);

			if (x + frameWidth <= sourceWidth && y + frameHeight <= sourceHeight) {
				const frameData = new Uint8ClampedArray(frameWidth * frameHeight * 4);
				const frameImageData = new ImageData(frameData, frameWidth, frameHeight);

				// Copy pixels from source to frame
				for (let fy = 0; fy < frameHeight; fy++) {
					for (let fx = 0; fx < frameWidth; fx++) {
						const sourceX = x + fx;
						const sourceY = y + fy;
						const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
						const frameIndex = (fy * frameWidth + fx) * 4;

						frameData[frameIndex] = sourceData[sourceIndex];
						frameData[frameIndex + 1] = sourceData[sourceIndex + 1];
						frameData[frameIndex + 2] = sourceData[sourceIndex + 2];
						frameData[frameIndex + 3] = sourceData[sourceIndex + 3];
					}
				}

				// Remove magenta pixels (transparency)
				for (let i = 0; i < frameData.length; i += 4) {
					if (frameData[i] === 255 &&
						frameData[i + 1] === 0 &&
						frameData[i + 2] === 255) {
						frameData[i + 3] = 0; // Make transparent
					}
				}

				frames.push(frameImageData);
			}
		}
	}

	return frames;
}

// Rotate image
function rotateImage(imageData: ImageData, degrees: number): ImageData {
	const radians = (degrees * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	const newWidth = Math.round(imageData.width * cos + imageData.height * sin);
	const newHeight = Math.round(imageData.width * sin + imageData.height * cos);

	const newData = new Uint8ClampedArray(newWidth * newHeight * 4);
	const newImageData = new ImageData(newData, newWidth, newHeight);

	const centerX = newWidth / 2;
	const centerY = newHeight / 2;
	const sourceCenterX = imageData.width / 2;
	const sourceCenterY = imageData.height / 2;

	for (let y = 0; y < newHeight; y++) {
		for (let x = 0; x < newWidth; x++) {
			// Calculate source coordinates
			const dx = x - centerX;
			const dy = y - centerY;
			const sourceX = Math.round(dx * Math.cos(radians) - dy * Math.sin(radians) + sourceCenterX);
			const sourceY = Math.round(dx * Math.sin(radians) + dy * Math.cos(radians) + sourceCenterY);

			const newIndex = (y * newWidth + x) * 4;

			if (sourceX >= 0 && sourceX < imageData.width && sourceY >= 0 && sourceY < imageData.height) {
				const sourceIndex = (sourceY * imageData.width + sourceX) * 4;
				newData[newIndex] = imageData.data[sourceIndex];
				newData[newIndex + 1] = imageData.data[sourceIndex + 1];
				newData[newIndex + 2] = imageData.data[sourceIndex + 2];
				newData[newIndex + 3] = imageData.data[sourceIndex + 3];
			} else {
				// Transparent pixel
				newData[newIndex] = 0;
				newData[newIndex + 1] = 0;
				newData[newIndex + 2] = 0;
				newData[newIndex + 3] = 0;
			}
		}
	}

	return newImageData;
}

// Flip image
function flipImage(imageData: ImageData, horizontal: boolean, vertical: boolean): ImageData {
	const newData = new Uint8ClampedArray(imageData.data.length);
	const newImageData = new ImageData(newData, imageData.width, imageData.height);
	const width = imageData.width;
	const height = imageData.height;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const sourceX = horizontal ? width - 1 - x : x;
			const sourceY = vertical ? height - 1 - y : y;

			const sourceIndex = (sourceY * width + sourceX) * 4;
			const destIndex = (y * width + x) * 4;

			newData[destIndex] = imageData.data[sourceIndex];
			newData[destIndex + 1] = imageData.data[sourceIndex + 1];
			newData[destIndex + 2] = imageData.data[sourceIndex + 2];
			newData[destIndex + 3] = imageData.data[sourceIndex + 3];
		}
	}

	return newImageData;
}

// Process pixels (generic pixel manipulation)
function processPixels(imageData: ImageData, operation: string, params: any): ImageData {
	const newData = new Uint8ClampedArray(imageData.data.length);
	const newImageData = new ImageData(newData, imageData.width, imageData.height);

	switch (operation) {
		case 'removeMagenta':
			for (let i = 0; i < imageData.data.length; i += 4) {
				if (imageData.data[i] === 255 &&
					imageData.data[i + 1] === 0 &&
					imageData.data[i + 2] === 255) {
					newData[i] = imageData.data[i];
					newData[i + 1] = imageData.data[i + 1];
					newData[i + 2] = imageData.data[i + 2];
					newData[i + 3] = 0; // Make transparent
				} else {
					newData[i] = imageData.data[i];
					newData[i + 1] = imageData.data[i + 1];
					newData[i + 2] = imageData.data[i + 2];
					newData[i + 3] = imageData.data[i + 3];
				}
			}
			break;
		default:
			// Default: copy as-is
			newData.set(imageData.data);
			break;
	}

	return newImageData;
}

// Helper to serialize ImageData for transfer
function serializeImageData(imageData: ImageData): any {
	return {
		data: Array.from(imageData.data),
		width: imageData.width,
		height: imageData.height,
	};
}

// Helper to deserialize ImageData
function deserializeImageData(serialized: any): ImageData {
	const data = new Uint8ClampedArray(serialized.data);
	return new ImageData(data, serialized.width, serialized.height);
}

// Handle messages from main thread
self.onmessage = (e: MessageEvent<ImageProcessorMessage>) => {
	const { id, type, data } = e.data;

	try {
		let result: ImageData | ImageData[];

		// Deserialize ImageData from message
		const imageData = deserializeImageData(data.imageData);

		switch (type) {
			case 'cutFrames':
				result = cutFrames(
					imageData,
					data.offsetX,
					data.offsetY,
					data.frameWidth,
					data.frameHeight,
					data.columns,
					data.rows
				);
				break;

			case 'rotateImage':
				result = rotateImage(imageData, data.degrees);
				break;

			case 'flipImage':
				result = flipImage(imageData, data.horizontal, data.vertical);
				break;

			case 'processPixels':
				result = processPixels(imageData, data.operation, data.params);
				break;

			default:
				throw new Error(`Unknown operation type: ${type}`);
		}

		// Serialize result for transfer
		const serializedResult = Array.isArray(result)
			? result.map(serializeImageData)
			: serializeImageData(result);

		const response: ImageProcessorResponse = {
			id,
			success: true,
			data: serializedResult,
		};

		self.postMessage(response);
	} catch (error: any) {
		const response: ImageProcessorResponse = {
			id,
			success: false,
			error: error.message || String(error),
		};

		self.postMessage(response);
	}
};

