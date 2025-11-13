# Multithreading Implementation

This document describes the multithreading implementation using Web Workers for computationally intensive image processing operations.

## Overview

The application now uses Web Workers to offload heavy image processing tasks from the main thread, preventing UI freezes and improving performance. The implementation includes:

- **Worker Pool**: A pool of web workers that can process multiple tasks in parallel
- **Image Processing Worker**: Specialized worker for image operations
- **Image Processing Service**: High-level API for image operations

## Architecture

### Components

1. **`ui/src/workers/imageProcessor.worker.ts`**
   - Web Worker that handles image processing operations
   - Operations: frame cutting, rotation, flipping, pixel manipulation
   - Runs in a separate thread, isolated from the main UI thread

2. **`ui/src/workers/workerPool.ts`**
   - Manages a pool of web workers
   - Automatically distributes tasks across available workers
   - Configures worker count based on CPU cores (default: 4-8 workers)

3. **`ui/src/services/ImageProcessingService.ts`**
   - High-level service API for image processing
   - Handles serialization/deserialization of ImageData
   - Provides async methods for all image operations

### How It Works

1. **Task Submission**: When an image operation is requested, the service creates a task message
2. **Worker Assignment**: The worker pool assigns the task to an available worker
3. **Parallel Processing**: Multiple workers can process different tasks simultaneously
4. **Result Return**: The worker sends results back to the main thread
5. **Deserialization**: ImageData is reconstructed from serialized data

## Usage

### In AnimationEditor

The `AnimationEditor` component now uses workers for:

- **Frame Cutting**: Extracting multiple frames from a sprite sheet
- **Image Rotation**: Rotating images by any angle
- **Image Flipping**: Flipping images horizontally or vertically

Example:
```typescript
const imageProcessingService = getImageProcessingService();

// Cut frames (runs in worker)
const frames = await imageProcessingService.cutFrames(
  imageData,
  offsetX, offsetY,
  frameWidth, frameHeight,
  columns, rows
);

// Rotate image (runs in worker)
const rotated = await imageProcessingService.rotateImage(imageData, 90);

// Flip image (runs in worker)
const flipped = await imageProcessingService.flipImage(imageData, true, false);
```

## Benefits

1. **Non-blocking UI**: Image processing no longer freezes the interface
2. **Parallel Processing**: Multiple operations can run simultaneously
3. **Better Performance**: Utilizes multiple CPU cores effectively
4. **Scalability**: Worker pool automatically adjusts to available resources

## Technical Details

### ImageData Serialization

Since `ImageData` cannot be directly transferred via `postMessage`, it's serialized:

```typescript
// Serialize
{
  data: Array.from(imageData.data),
  width: imageData.width,
  height: imageData.height
}

// Deserialize
const data = new Uint8ClampedArray(serialized.data);
const imageData = new ImageData(data, serialized.width, serialized.height);
```

### Worker Pool Configuration

- **Default Workers**: `navigator.hardwareConcurrency || 4`
- **Maximum Workers**: 8 (to prevent resource exhaustion)
- **Minimum Workers**: 1 (fallback for single-core systems)

### Error Handling

All worker operations include error handling:
- Worker errors are caught and returned as error responses
- Main thread receives error messages for user feedback
- Processing state is managed to prevent concurrent operations

## Future Enhancements

Potential improvements:

1. **Transferable Objects**: Use `Transferable` for better performance with large images
2. **Batch Processing**: Process multiple frames in parallel batches
3. **Worker Specialization**: Create specialized workers for different operation types
4. **Progress Reporting**: Add progress callbacks for long-running operations
5. **Backend Workers**: Implement Node.js worker threads for server-side operations

## Performance Considerations

- **Memory**: Serialization creates temporary copies of image data
- **CPU**: Worker pool size should match available CPU cores
- **Network**: Large images may take time to serialize/deserialize

## Testing

To test the multithreading implementation:

1. Open the Animation Editor
2. Load a large sprite sheet image
3. Set multiple rows/columns for frame extraction
4. Click "Crop" - processing should not freeze the UI
5. Try rotating/flipping large images - UI should remain responsive

## Notes

- Workers are shared across the application (singleton pattern)
- Worker pool is initialized on first use
- Workers remain active for the lifetime of the application
- Cleanup occurs when the application closes

