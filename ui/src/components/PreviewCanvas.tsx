import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import './PreviewCanvas.css';

// Cache for converted ImageData objects to avoid re-processing same sprites
const imageDataCache = new Map<string, ImageData>();
const MAX_CACHE_SIZE = 200; // Limit cache size to prevent memory issues

// Helper to create cache key from sprite data - optimized to avoid creating new arrays
const getCacheKey = (pixels: ArrayBuffer | Uint8Array, size: number): string => {
	if (pixels instanceof ArrayBuffer) {
		// Use DataView to read first byte without creating new array
		const firstByte = pixels.byteLength > 0 ? new DataView(pixels).getUint8(0) : 0;
		return `${size}-${pixels.byteLength}-${firstByte}`;
	}
	// Uint8Array - direct access, no allocation needed
	const firstByte = pixels.length > 0 ? pixels[0] : 0;
	return `${size}-${pixels.length}-${firstByte}`;
};

interface PreviewCanvasProps {
	thingData?: any;
	width?: number;
	height?: number;
	frameGroupType?: number; // FrameGroupType (0 = DEFAULT, etc.)
	patternX?: number;
	patternY?: number;
	patternZ?: number;
	animate?: boolean;
	zoom?: number;
	currentFrame?: number;
	onFrameChange?: (frame: number) => void; // Reserved for future use
	showAllPatterns?: boolean;
	backgroundColor?: string;
	showGrid?: boolean;
	onPanChange?: (x: number, y: number) => void;
	panX?: number;
	panY?: number;
	onSpriteDrop?: (spriteId: number, spriteIndex: number) => void;
}

const PreviewCanvasComponent: React.FC<PreviewCanvasProps> = ({
	thingData,
	width = 256,
	height = 256,
	frameGroupType = 0, // DEFAULT
	patternX = 0,
	patternY = 0,
	patternZ = 0,
	animate = false,
	zoom = 1,
	currentFrame: currentFrameProp,
	onFrameChange: _onFrameChange,
	showAllPatterns = false,
	backgroundColor = '#494949',
	showGrid = false,
	onPanChange,
	panX = 0,
	panY = 0,
	onSpriteDrop,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const animationFrameRef = useRef<number | null>(null);
	const [internalFrame, setInternalFrame] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const isDraggingRef = useRef(false);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const lastPanRef = useRef({ x: panX, y: panY });
  
	// Use prop frame when not animating, internal frame when animating
	const currentFrame = animate ? internalFrame : (currentFrameProp !== undefined ? currentFrameProp : 0);
	
	// Sync internal frame with prop when not animating
	useEffect(() => {
		if (!animate && currentFrameProp !== undefined) {
			setInternalFrame(currentFrameProp);
		}
	}, [currentFrameProp, animate]);

	// Sync pan values
	useEffect(() => {
		lastPanRef.current = { x: panX, y: panY };
	}, [panX, panY]);

	// Memoize render parameters to avoid unnecessary re-renders
	const renderParams = useMemo(() => ({
		zoomedWidth: width * zoom,
		zoomedHeight: height * zoom,
	}), [width, height, zoom]);

	// Store render parameters in refs to avoid unnecessary re-renders
	const renderParamsRef = useRef({
		frameGroupType,
		patternX,
		patternY,
		patternZ,
		currentFrame,
		showAllPatterns,
		zoom,
		backgroundColor,
		showGrid,
	});

	// Update ref when values change (doesn't trigger re-render)
	useEffect(() => {
		renderParamsRef.current = {
			frameGroupType,
			patternX,
			patternY,
			patternZ,
			currentFrame,
			showAllPatterns,
			zoom,
			backgroundColor,
			showGrid,
		};
	}, [frameGroupType, patternX, patternY, patternZ, currentFrame, showAllPatterns, zoom, backgroundColor, showGrid]);

	useEffect(() => {
		if (!thingData || !canvasRef.current) {
			return;
		}

		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
		if (!ctx) return;

		// Use requestAnimationFrame for smoother rendering
		let rafId: number;
		const render = () => {
			const params = renderParamsRef.current;
			renderThing(ctx, thingData, renderParams.zoomedWidth, renderParams.zoomedHeight, params.frameGroupType, params.patternX, params.patternY, params.patternZ, params.currentFrame, params.showAllPatterns, params.zoom, params.backgroundColor, params.showGrid, lastPanRef.current.x, lastPanRef.current.y);
		};
		
		rafId = requestAnimationFrame(render);
		
		return () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [thingData, renderParams.zoomedWidth, renderParams.zoomedHeight]);

	// Pan/drag handlers - optimized with throttling and cached rect
	useEffect(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper || zoom <= 1) {
			return;
		}

		let rafId: number | null = null;
		let cachedRect: DOMRect | null = null;
		let rectCacheTime = 0;
		const RECT_CACHE_DURATION = 100; // Cache rect for 100ms

		// Cache getBoundingClientRect to avoid repeated calls
		const getCachedRect = (): DOMRect => {
			const now = performance.now();
			if (!cachedRect || (now - rectCacheTime) > RECT_CACHE_DURATION) {
				cachedRect = wrapper.getBoundingClientRect();
				rectCacheTime = now;
			}
			return cachedRect;
		};

		const handleMouseDown = (e: MouseEvent) => {
			if (e.button === 0) { // Left mouse button
				isDraggingRef.current = true;
				const rect = getCachedRect();
				dragStartRef.current = {
					x: e.clientX - rect.left - lastPanRef.current.x,
					y: e.clientY - rect.top - lastPanRef.current.y,
				};
				wrapper.style.cursor = 'grabbing';
				e.preventDefault();
			}
		};

		// Throttle mouse move using requestAnimationFrame
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDraggingRef.current || !wrapperRef.current) {
				return;
			}

			// Cancel previous frame if pending
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			// Schedule update for next frame
			rafId = requestAnimationFrame(() => {
				rafId = null;
				const rect = getCachedRect();
				const newPanX = e.clientX - rect.left - dragStartRef.current.x;
				const newPanY = e.clientY - rect.top - dragStartRef.current.y;
				lastPanRef.current = { x: newPanX, y: newPanY };
				if (onPanChange) {
					onPanChange(newPanX, newPanY);
				}
			});
		};

		const handleMouseUp = () => {
			if (isDraggingRef.current && wrapperRef.current) {
				isDraggingRef.current = false;
				wrapperRef.current.style.cursor = 'grab';
				// Cancel any pending animation frame
				if (rafId !== null) {
					cancelAnimationFrame(rafId);
					rafId = null;
				}
			}
		};

		wrapper.addEventListener('mousedown', handleMouseDown);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			wrapper.removeEventListener('mousedown', handleMouseDown);
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [zoom, onPanChange]);

	// Reset pan when zoom changes
	useEffect(() => {
		if (onPanChange) {
			onPanChange(0, 0);
		}
	}, [zoom]);

	// Animation effect
	useEffect(() => {
		if (!animate || !thingData) {
			setIsAnimating(false);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
			setInternalFrame(0);
			return;
		}

    // Get frame group to determine animation properties
    const frameGroup = thingData.thing?.frameGroups?.[frameGroupType];
    if (!frameGroup || !frameGroup.isAnimation || frameGroup.frames <= 1) {
      setIsAnimating(false);
      setInternalFrame(0);
      return;
    }

		setIsAnimating(true);
		let frame = internalFrame;
		let lastTime = performance.now();
		let accumulatedTime = 0;
		let loopCount = 0;
		const maxLoops = frameGroup.loopCount > 0 ? frameGroup.loopCount : Infinity;

		// Pre-calculate frame durations to avoid repeated lookups
		const frameDurations = frameGroup.frameDurations || [];
		const isAsync = frameGroup.animationMode === 0; // ASYNCHRONOUS = 0
		const defaultDuration = 100;

		const animateFrame = (timestamp: number) => {
			const deltaTime = timestamp - lastTime;
			lastTime = timestamp;
			accumulatedTime += deltaTime;

			// Get frame duration - optimized lookup
			let duration = defaultDuration;
			if (frameDurations.length > frame) {
				const frameDuration = frameDurations[frame];
				if (frameDuration) {
					const min = frameDuration.minimum || defaultDuration;
					const max = frameDuration.maximum || defaultDuration;
					// Use average of min and max, or random between them for asynchronous mode
					duration = isAsync ? (min + Math.random() * (max - min)) : ((min + max) / 2);
				}
			}

			if (accumulatedTime >= duration) {
				accumulatedTime = 0;
				frame = (frame + 1) % frameGroup.frames;
				
				// Check if we've completed a loop
				if (frame === 0) {
					loopCount++;
					if (loopCount >= maxLoops) {
						// Stop animation after max loops
						setIsAnimating(false);
						if (animationFrameRef.current) {
							cancelAnimationFrame(animationFrameRef.current);
							animationFrameRef.current = null;
						}
						return;
					}
				}
				
				// Only update state if frame actually changed (avoid unnecessary re-renders)
				setInternalFrame(frame);
			}

			animationFrameRef.current = requestAnimationFrame(animateFrame);
		};

		animationFrameRef.current = requestAnimationFrame(animateFrame);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		};
	}, [animate, thingData, frameGroupType]);

	const renderThing = (
		ctx: CanvasRenderingContext2D,
		thingData: any,
		canvasWidth: number,
		canvasHeight: number,
		groupType: number,
		px: number,
		py: number,
		pz: number,
		frame: number,
		showAllPatterns: boolean = false,
		zoom: number = 1,
		backgroundColor: string = '#494949',
		showGrid: boolean = false,
		panX: number = 0,
		panY: number = 0
	) => {
		// Clear canvas
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		// Set background color
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		// Scale context by zoom so content renders at correct size
		// canvasWidth/Height are already zoomed, so we need to scale by zoom
		// to render base-size content that appears zoomed
		ctx.save();
		ctx.scale(zoom, zoom);
		
		// Apply pan offset when zoomed (in base coordinates)
		if (zoom > 1) {
			ctx.translate(panX / zoom, panY / zoom);
		}
    
    // Now render at base size - all coordinates will be automatically scaled
    const baseWidth = canvasWidth / zoom;
    const baseHeight = canvasHeight / zoom;

		if (!thingData) {
			renderPlaceholder(ctx, baseWidth, baseHeight);
			ctx.restore();
			return;
		}

		// Try to get frame group from thing
		const frameGroup = thingData.thing?.frameGroups?.[groupType];
		if (!frameGroup) {
			// Fallback to simple sprite rendering
			if (thingData.sprites && thingData.sprites.length > 0) {
				renderSprites(ctx, thingData.sprites, baseWidth, baseHeight);
			} else if (thingData.pixels) {
				renderSpritePixels(ctx, thingData.pixels, baseWidth, baseHeight);
			} else {
				renderPlaceholder(ctx, baseWidth, baseHeight);
			}
			ctx.restore();
			return;
		}

		// Get sprites for this frame group
		let groupSprites: any[] = [];
		if (thingData.sprites) {
			if (thingData.sprites instanceof Map) {
				// If it's a Map, get sprites for the frame group type
				groupSprites = thingData.sprites.get(groupType) || [];
			} else if (Array.isArray(thingData.sprites)) {
				// If it's an array, use it directly (legacy format)
				groupSprites = thingData.sprites;
			} else if (typeof thingData.sprites === 'object') {
				// If it's an object with numeric keys
				groupSprites = thingData.sprites[groupType] || thingData.sprites[0] || [];
			}
		}
		
		if (!groupSprites || groupSprites.length === 0) {
			renderPlaceholder(ctx, baseWidth, baseHeight);
			ctx.restore();
			return;
		}

		// Render grid overlay if enabled - optimized to reduce path operations
		if (showGrid) {
			ctx.save();
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
			ctx.lineWidth = 1 / zoom; // Scale line width with zoom
			const gridSize = 32; // Standard sprite size
			
			// Batch grid lines for better performance
			ctx.beginPath();
			for (let x = 0; x <= baseWidth; x += gridSize) {
				ctx.moveTo(x, 0);
				ctx.lineTo(x, baseHeight);
			}
			for (let y = 0; y <= baseHeight; y += gridSize) {
				ctx.moveTo(0, y);
				ctx.lineTo(baseWidth, y);
			}
			ctx.stroke();
			ctx.restore();
		}

		// Render multi-sprite composition
		// Show all patterns only if explicitly requested
		renderFrameGroup(ctx, frameGroup, groupSprites, baseWidth, baseHeight, px, py, pz, frame, showAllPatterns);
		ctx.restore();
	};

	const renderFrameGroup = (
		ctx: CanvasRenderingContext2D,
		frameGroup: any,
		sprites: any[],
		canvasWidth: number,
		canvasHeight: number,
		px: number,
		py: number,
		pz: number,
		frame: number,
		showAllPatterns: boolean = false
	) => {
    const spriteSize = frameGroup.exactSize || 32;
    const patternX = frameGroup.patternX || 1;
    const patternY = frameGroup.patternY || 1;
    const patternZ = frameGroup.patternZ || 1;
    const frames = frameGroup.frames || 1;

    // If showing all patterns, render a grid of patternX x patternY
    if (showAllPatterns && (patternX > 1 || patternY > 1)) {
      const gridCols = patternX;
      const gridRows = patternY;
      const width = frameGroup.width || 1;
      const height = frameGroup.height || 1;
      const cellWidth = width * spriteSize;
      const cellHeight = height * spriteSize;
      const gridWidth = gridCols * cellWidth;
      const gridHeight = gridRows * cellHeight;
      
      // Scale to fit canvas (canvas is already at base size due to zoom scaling in renderThing)
      // We want to fit the grid within the available canvas space
      const scaleX = canvasWidth / gridWidth;
      const scaleY = canvasHeight / gridHeight;
      let scale = Math.min(scaleX, scaleY); // Allow scaling to fit
      
      // Ensure scale is not zero or too small, but allow it to be less than 1 to fit
      if (scale <= 0 || !isFinite(scale)) {
        scale = 0.1; // Fallback minimum scale
      }
      
      // Calculate cell dimensions after scaling
      const scaledCellWidth = cellWidth * scale;
      const scaledCellHeight = cellHeight * scale;
      const scaledGridWidth = gridWidth * scale;
      const scaledGridHeight = gridHeight * scale;
      
			// Center the grid on canvas (ensure positive offsets)
			const startX = Math.max(0, (canvasWidth - scaledGridWidth) / 2);
			const startY = Math.max(0, (canvasHeight - scaledGridHeight) / 2);
      
      // Render each cell in the grid
			for (let pyIdx = 0; pyIdx < gridRows; pyIdx++) {
				for (let pxIdx = 0; pxIdx < gridCols; pxIdx++) {
          // Calculate cell position
          const cellX = startX + pxIdx * scaledCellWidth;
          const cellY = startY + pyIdx * scaledCellHeight;
          
          // Render this pattern variation in its cell
          // For patternY (addons), combine base with the patternY layer
					if (patternY > 1 && pyIdx > 0) {
						// Render base (patternY=0) first, scaled and positioned
						ctx.save();
						ctx.translate(cellX, cellY);
						ctx.scale(scale, scale);
						renderSinglePattern(ctx, frameGroup, sprites, cellWidth, cellHeight, pxIdx, 0, pz, frame, 0, 0);
						ctx.restore();

						// Then overlay only the current patternY layer for this cell
						ctx.save();
						ctx.translate(cellX, cellY);
						ctx.scale(scale, scale);
						renderSinglePattern(ctx, frameGroup, sprites, cellWidth, cellHeight, pxIdx, pyIdx, pz, frame, 0, 0, false);
						ctx.restore();
					} else {
						// No patternY variations or base layer, just render the single pattern
						ctx.save();
						ctx.translate(cellX, cellY);
						ctx.scale(scale, scale);
						renderSinglePattern(ctx, frameGroup, sprites, cellWidth, cellHeight, pxIdx, pyIdx, pz, frame, 0, 0);
						ctx.restore();
					}
        }
      }
      return;
    }

    // Clamp pattern values
    const pxClamped = Math.max(0, Math.min(px, patternX - 1));
    const pyClamped = Math.max(0, Math.min(py, patternY - 1));
    const pzClamped = Math.max(0, Math.min(pz, patternZ - 1));
    const frameClamped = frame % frames;

    // Calculate composition bounds
    const width = frameGroup.width || 1;
    const height = frameGroup.height || 1;
    const totalWidth = width * spriteSize;
    const totalHeight = height * spriteSize;

		// Center the composition on canvas (ensure positive offsets)
		const offsetX = Math.max(0, (canvasWidth - totalWidth) / 2);
		const offsetY = Math.max(0, (canvasHeight - totalHeight) / 2);
    
	// Render the selected composition. When patternY has multiple layers, we combine base + addon layers up to the
	// selected pattern value to mimic the in-game appearance.
	renderSinglePattern(ctx, frameGroup, sprites, totalWidth, totalHeight, pxClamped, pyClamped, pzClamped, frameClamped, offsetX, offsetY);
  };

	const renderSinglePattern = (
		ctx: CanvasRenderingContext2D,
		frameGroup: any,
		sprites: any[],
		_totalWidth: number,
		_totalHeight: number,
		px: number,
		py: number,
		pz: number,
		frame: number,
		offsetX: number = 0,
		offsetY: number = 0,
		stackAddonLayers: boolean = true
	) => {
		const spriteSize = frameGroup.exactSize || 32;
		const layers = frameGroup.layers || 1;
		const width = frameGroup.width || 1;
		const height = frameGroup.height || 1;
		const frames = frameGroup.frames || 1;
		const patternX = frameGroup.patternX || 1;
		const patternY = frameGroup.patternY || 1;
		const patternZ = frameGroup.patternZ || 1;

		const pxClamped = Math.max(0, Math.min(px, patternX - 1));
		const pyClamped = Math.max(0, Math.min(py, patternY - 1));
		const pzClamped = Math.max(0, Math.min(pz, patternZ - 1));
		const frameClamped = frame % frames;

		// Helper function to calculate sprite index using FrameGroup formula
		const getSpriteIndex = (w: number, h: number, l: number, px: number, py: number, pz: number, f: number): number => {
			if (typeof frameGroup.getSpriteIndex === 'function') {
				return frameGroup.getSpriteIndex(w, h, l, px, py, pz, f);
			}
			// Fallback calculation using the same formula as FrameGroup.getSpriteIndex
			// Formula: ((((((frame % frames) * patternZ + pz) * patternY + py) * patternX + px) * layers + l) * height + h) * width + w
			const frameMod = f % frames;
			const step1 = frameMod * patternZ + pz;
			const step2 = step1 * patternY + py;
			const step3 = step2 * patternX + px;
			const step4 = step3 * layers + l;
			const step5 = step4 * height + h;
			const step6 = step5 * width + w;
			return step6;
		};

		// Helper to extract pixels from sprite data - memoized outside loop
		const extractPixels = (spriteData: any): Uint8Array | ArrayBuffer | null => {
			if (!spriteData) return null;
			
			if (spriteData.pixels) {
				if (spriteData.pixels instanceof ArrayBuffer) {
					return spriteData.pixels;
				} else if (spriteData.pixels instanceof Uint8Array) {
					return spriteData.pixels.buffer;
				} else if (Buffer.isBuffer && Buffer.isBuffer(spriteData.pixels)) {
					const buffer = spriteData.pixels.buffer;
					return buffer instanceof ArrayBuffer ? buffer.slice(
						spriteData.pixels.byteOffset,
						spriteData.pixels.byteOffset + spriteData.pixels.byteLength
					) : new Uint8Array(spriteData.pixels).buffer;
				} else {
					return spriteData.pixels;
				}
			} else if (spriteData instanceof ArrayBuffer) {
				return spriteData;
			} else if (spriteData instanceof Uint8Array) {
				return spriteData.buffer instanceof ArrayBuffer ? spriteData.buffer : null;
			} else if (Buffer.isBuffer && Buffer.isBuffer(spriteData)) {
				const buffer = spriteData.buffer;
				if (buffer instanceof ArrayBuffer) {
					return buffer.slice(
						spriteData.byteOffset,
						spriteData.byteOffset + spriteData.byteLength
					);
				} else {
					return new Uint8Array(spriteData).buffer;
				}
			} else if (Array.isArray(spriteData)) {
				return new Uint8Array(spriteData).buffer;
			}
			return null;
		};

		const renderLayer = (pyValue: number) => {
			// Pre-calculate sprite positions to avoid repeated calculations
			for (let l = 0; l < layers; l++) {
				for (let w = 0; w < width; w++) {
					const x = offsetX + (width - w - 1) * spriteSize;
					for (let h = 0; h < height; h++) {
						const y = offsetY + (height - h - 1) * spriteSize;
						const spriteIndex = getSpriteIndex(w, h, l, pxClamped, pyValue, pzClamped, frameClamped);

						// Early exit if index is invalid
						if (spriteIndex < 0 || spriteIndex >= sprites.length) {
							continue;
						}

						const spriteData = sprites[spriteIndex];
						if (!spriteData) {
							continue;
						}

						const pixels = extractPixels(spriteData);
						if (pixels) {
							renderSpritePixelsAt(ctx, pixels, x, y, spriteSize);
						}
					}
				}
			}
		};

		if (patternY > 1 && stackAddonLayers) {
			renderLayer(0);

			for (let pyIdx = 1; pyIdx <= pyClamped; pyIdx++) {
				renderLayer(pyIdx);
			}
		} else {
			renderLayer(pyClamped);
		}
	};

  const renderSpritePixelsAt = (
    ctx: CanvasRenderingContext2D,
    pixels: Uint8Array | ArrayBuffer | Buffer,
    x: number,
    y: number,
    size: number
  ) => {
    try {
      let pixelData: Uint8Array;
      if (pixels instanceof ArrayBuffer) {
        pixelData = new Uint8Array(pixels);
      } else if (Buffer.isBuffer && Buffer.isBuffer(pixels)) {
        pixelData = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      } else if (pixels instanceof Uint8Array) {
        pixelData = pixels;
      } else {
        console.warn('Unknown pixel data format:', typeof pixels);
        return;
      }

      // Check cache first
      const cacheKey = getCacheKey(pixelData, size);
      let imageData = imageDataCache.get(cacheKey);
      
      if (!imageData) {
        // Validate pixel data length
        const expectedLength = size * size * 4;
        imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        if (pixelData.length < expectedLength) {
          // Only warn if the difference is significant (more than 10% missing)
          if (pixelData.length < expectedLength * 0.9) {
            console.warn(`Sprite pixel data too short: expected ${expectedLength} bytes, got ${pixelData.length}`);
          }
          // Fill with transparent pixels if data is incomplete, or use available data
          const availablePixels = Math.floor(pixelData.length / 4);
          const pixelCount = size * size;
          
          // Copy available pixel data - optimized loop
          const copyCount = Math.min(availablePixels, pixelCount);
          for (let i = 0; i < copyCount; i++) {
            const srcIdx = i * 4;
            const dstIdx = i * 4;
            // ARGB to RGBA conversion
            data[dstIdx] = pixelData[srcIdx + 1] || 0;     // R
            data[dstIdx + 1] = pixelData[srcIdx + 2] || 0; // G
            data[dstIdx + 2] = pixelData[srcIdx + 3] || 0; // B
            data[dstIdx + 3] = pixelData[srcIdx] ?? 255;   // A
          }
          
          // Fill remaining pixels with transparency - optimized with typed array
          if (availablePixels < pixelCount) {
            const fillStart = availablePixels * 4;
            const fillEnd = pixelCount * 4;
            data.fill(0, fillStart, fillEnd);
          }
        } else {
          // Convert ARGB pixels to RGBA ImageData - optimized loop
          // Tibia sprites use ARGB format (Alpha, Red, Green, Blue), not RGBA
          const pixelCount = size * size;
          // Use direct memory access for better performance
          for (let i = 0; i < pixelCount; i++) {
            const srcIdx = i * 4;
            const dstIdx = i * 4;
            // Convert from ARGB to RGBA for canvas ImageData
            data[dstIdx] = pixelData[srcIdx + 1] || 0;     // R
            data[dstIdx + 1] = pixelData[srcIdx + 2] || 0;   // G
            data[dstIdx + 2] = pixelData[srcIdx + 3] || 0;  // B
            data[dstIdx + 3] = pixelData[srcIdx] ?? 255;     // A
          }
        }

        // Cache the ImageData (limit cache size)
        if (imageDataCache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entry (first key)
          const firstKey = imageDataCache.keys().next().value;
          if (firstKey !== undefined) {
            imageDataCache.delete(firstKey);
          }
        }
        imageDataCache.set(cacheKey, imageData);
      }

      ctx.putImageData(imageData, x, y);
    } catch (error) {
      console.error('Error rendering sprite pixels:', error);
    }
  };

	const renderSpritePixels = (
		ctx: CanvasRenderingContext2D,
		pixels: Uint8Array | ArrayBuffer | Buffer,
		canvasWidth: number,
		canvasHeight: number
	) => {
		const spriteSize = 32;
		const x = Math.max(0, (canvasWidth - spriteSize) / 2);
		const y = Math.max(0, (canvasHeight - spriteSize) / 2);
		renderSpritePixelsAt(ctx, pixels, x, y, spriteSize);
	};

	const renderSprites = (
		ctx: CanvasRenderingContext2D,
		sprites: any[],
		canvasWidth: number,
		canvasHeight: number
	) => {
		// Render all sprites layered on top of each other
		const spriteSize = 32;
		const x = Math.max(0, (canvasWidth - spriteSize) / 2);
		const y = Math.max(0, (canvasHeight - spriteSize) / 2);

		for (const sprite of sprites) {
			if (sprite && sprite.pixels) {
				renderSpritePixelsAt(ctx, sprite.pixels, x, y, spriteSize);
			}
		}
	};

	const renderPlaceholder = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
		ctx.fillStyle = '#999999';
		ctx.font = '14px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('No preview available', width / 2, height / 2);
	};

	// Canvas should be rendered at zoomed size for proper pixel rendering
	const canvasWidth = useMemo(() => width * zoom, [width, zoom]);
	const canvasHeight = useMemo(() => height * zoom, [height, zoom]);

	const canPan = zoom > 1;

	// Helper function to calculate sprite index from mouse position - optimized
	const getSpriteIndexFromPosition = useCallback((clientX: number, clientY: number): number | null => {
		if (!thingData || !canvasRef.current || !wrapperRef.current) {
			return null;
		}

		const params = renderParamsRef.current;
		const frameGroup = thingData.thing?.frameGroups?.[params.frameGroupType];
		if (!frameGroup) {
			return null;
		}

		const wrapper = wrapperRef.current;
		const rect = wrapper.getBoundingClientRect();
		
		// Get mouse position relative to wrapper
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		
		// Account for pan offset - use current zoom from params
		const baseX = (x - lastPanRef.current.x) / params.zoom;
		const baseY = (y - lastPanRef.current.y) / params.zoom;
		
		// Pre-calculate frame group properties
		const spriteSize = frameGroup.exactSize || 32;
		const frameWidth = frameGroup.width || 1;
		const frameHeight = frameGroup.height || 1;
		const layers = frameGroup.layers || 1;
		const patternXCount = frameGroup.patternX || 1;
		const patternYCount = frameGroup.patternY || 1;
		const patternZCount = frameGroup.patternZ || 1;
		const frames = frameGroup.frames || 1;
		
		// Calculate total composition size
		const totalWidth = frameWidth * spriteSize;
		const totalHeight = frameHeight * spriteSize;
		
		// Calculate offset (centering) - optimize calculation
		const baseCanvasWidth = width * params.zoom;
		const baseCanvasHeight = height * params.zoom;
		const offsetX = Math.max(0, (baseCanvasWidth / params.zoom - totalWidth) / 2);
		const offsetY = Math.max(0, (baseCanvasHeight / params.zoom - totalHeight) / 2);
		
		// Early exit if click is outside bounds
		if (baseX < offsetX || baseX >= offsetX + totalWidth ||
			baseY < offsetY || baseY >= offsetY + totalHeight) {
			return null;
		}
		
		// Calculate which sprite cell (w, h, l) was clicked
		// Sprites are rendered from bottom-right to top-left
		const relativeX = baseX - offsetX;
		const relativeY = baseY - offsetY;
		
		// Calculate grid position (w, h) - optimize with single division
		const spriteSizeInv = 1 / spriteSize;
		const w = frameWidth - 1 - Math.floor(relativeX * spriteSizeInv);
		const h = frameHeight - 1 - Math.floor(relativeY * spriteSizeInv);
		
		// Clamp values - use Math.max/min for better performance
		const wClamped = Math.max(0, Math.min(w, frameWidth - 1));
		const hClamped = Math.max(0, Math.min(h, frameHeight - 1));
		
		// Use layer 0 (could be enhanced to detect layer from pixel data)
		const l = 0;
		
		// Use current pattern and frame values from params
		const pxClamped = Math.max(0, Math.min(params.patternX, patternXCount - 1));
		const pyClamped = Math.max(0, Math.min(params.patternY, patternYCount - 1));
		const pzClamped = Math.max(0, Math.min(params.patternZ, patternZCount - 1));
		const frameClamped = params.currentFrame % frames;
		
		// Calculate sprite index - inline for better performance
		if (typeof frameGroup.getSpriteIndex === 'function') {
			return frameGroup.getSpriteIndex(wClamped, hClamped, l, pxClamped, pyClamped, pzClamped, frameClamped);
		}
		
		// Fallback calculation - optimized
		const frameMod = frameClamped;
		const step1 = frameMod * patternZCount + pzClamped;
		const step2 = step1 * patternYCount + pyClamped;
		const step3 = step2 * patternXCount + pxClamped;
		const step4 = step3 * layers + l;
		const step5 = step4 * frameHeight + hClamped;
		return step5 * frameWidth + wClamped;
	}, [thingData, width, height]);

	// Drag and drop handlers
	const handleDragEnter = (e: React.DragEvent) => {
		if (onSpriteDrop && thingData) {
			e.preventDefault();
			setIsDragOver(true);
		}
	};

	const handleDragLeave = (e: React.DragEvent) => {
		// Only set drag over to false if we're leaving the wrapper itself
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragOver(false);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		if (onSpriteDrop && thingData) {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
		
		if (!onSpriteDrop || !thingData) {
			return;
		}
		
		// Try to get sprite ID from drag data
		let spriteId: number | null = null;
		
		try {
			const jsonData = e.dataTransfer.getData('application/json');
			if (jsonData) {
				const dragData = JSON.parse(jsonData);
				spriteId = dragData.spriteId;
			}
		} catch (error) {
			// Fallback to text data
			const textData = e.dataTransfer.getData('text/plain');
			if (textData && textData.startsWith('sprite:')) {
				spriteId = parseInt(textData.substring(7), 10);
			}
		}
		
		if (spriteId === null || isNaN(spriteId)) {
			return;
		}
		
		// Get sprite index from drop position
		const spriteIndex = getSpriteIndexFromPosition(e.clientX, e.clientY);
		
		if (spriteIndex !== null && spriteIndex >= 0) {
			onSpriteDrop(spriteId, spriteIndex);
		}
	};

	return (
		<div className="preview-canvas-container" title="PreviewCanvas component">
			<div 
				ref={wrapperRef}
				className={`preview-canvas-wrapper ${canPan ? 'preview-canvas-pannable' : ''} ${isDragOver ? 'drag-over' : ''}`}
				title="preview-canvas-wrapper"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				style={{ cursor: canPan ? 'grab' : (onSpriteDrop ? 'copy' : 'default') }}
			>
				<canvas
					ref={canvasRef}
					width={canvasWidth}
					height={canvasHeight}
					className="preview-canvas"
					title="preview-canvas (HTMLCanvasElement)"
					style={{
						width: canvasWidth,
						height: canvasHeight,
						imageRendering: 'pixelated',
					}}
				/>
			</div>
			{isAnimating && (
				<div className="preview-animation-indicator" title="preview-animation-indicator (Animation playing)">
					●
				</div>
			)}
		</div>
	);
};

export const PreviewCanvas = React.memo(PreviewCanvasComponent);
