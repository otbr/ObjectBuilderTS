import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileDialogService } from '../services/FileDialogService';
import { useToast } from '../hooks/useToast';
import { useWorker } from '../contexts/WorkerContext';
import { useProgress } from '../contexts/ProgressContext';
import { CommandFactory } from '../services/CommandFactory';
import { getImageProcessingService } from '../services/ImageProcessingService';
import { Button } from './Button';
import './Slicer.css';

interface SlicerProps {
	onClose?: () => void;
}

interface SpriteSlice {
	imageData: ImageData;
	x: number;
	y: number;
	width: number;
	height: number;
}

export const Slicer: React.FC<SlicerProps> = ({ onClose: _onClose }) => {
	const { showError, showSuccess } = useToast();
	const worker = useWorker();
	const { showProgress, hideProgress } = useProgress();
	const [image, setImage] = useState<HTMLImageElement | null>(null);
	const [slices, setSlices] = useState<SpriteSlice[]>([]);
	const [offsetX, setOffsetX] = useState<number>(0);
	const [offsetY, setOffsetY] = useState<number>(0);
	const [spriteSize, setSpriteSize] = useState<number>(32);
	const [columns, setColumns] = useState<number>(1);
	const [rows, setRows] = useState<number>(1);
	const [zoom, setZoom] = useState<number>(1.0);
	const [includeEmpty, setIncludeEmpty] = useState<boolean>(false);
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
	const [isProcessing, setIsProcessing] = useState<boolean>(false);
	const imageContainerRef = useRef<HTMLDivElement>(null);
	const gridOverlayRef = useRef<HTMLDivElement>(null);

	const fileDialog = FileDialogService.getInstance();
	const imageProcessingService = getImageProcessingService();

	// Load image from file
	const handleOpenFile = useCallback(async () => {
		try {
			const result = await fileDialog.openImageFiles();
			if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
				const filePath = result.filePaths[0];
				const img = new Image();
				img.onload = () => {
					setImage(img);
					setOffsetX(0);
					setOffsetY(0);
					setSlices([]);
					// Auto-calculate max columns/rows
					if (img.width > 0 && img.height > 0) {
						setColumns(Math.floor(img.width / spriteSize));
						setRows(Math.floor(img.height / spriteSize));
					}
				};
				img.onerror = () => {
					showError('Failed to load image file');
				};
				const electronAPI = (window as any).electronAPI;
				if (electronAPI && electronAPI.readFile) {
					try {
						const fileData = await electronAPI.readFile(filePath);
						if (fileData && fileData.data) {
							const blob = new Blob([fileData.data], { type: 'image/png' });
							img.src = URL.createObjectURL(blob);
						} else {
							img.src = `file://${filePath}`;
						}
					} catch (err) {
						img.src = `file://${filePath}`;
					}
				} else {
					img.src = `file://${filePath}`;
				}
			}
		} catch (error: any) {
			showError(`Failed to open file: ${error.message}`);
		}
	}, [fileDialog, showError, spriteSize]);

	// Cut sprites from image
	const handleCutSprites = useCallback(async () => {
		if (!image || isProcessing) return;

		setIsProcessing(true);
		try {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				setIsProcessing(false);
				return;
			}

			canvas.width = image.width;
			canvas.height = image.height;
			ctx.drawImage(image, 0, 0);
			const fullImageData = ctx.getImageData(0, 0, image.width, image.height);

			const newSlices: SpriteSlice[] = [];

			for (let c = 0; c < columns; c++) {
				for (let r = 0; r < rows; r++) {
					const x = offsetX + (c * spriteSize);
					const y = offsetY + (r * spriteSize);

					if (x + spriteSize > image.width || y + spriteSize > image.height) {
						continue;
					}

					const spriteImageData = ctx.createImageData(spriteSize, spriteSize);
					for (let sy = 0; sy < spriteSize; sy++) {
						for (let sx = 0; sx < spriteSize; sx++) {
							const srcX = x + sx;
							const srcY = y + sy;
							if (srcX < image.width && srcY < image.height) {
								const srcIdx = (srcY * image.width + srcX) * 4;
								const dstIdx = (sy * spriteSize + sx) * 4;
								spriteImageData.data[dstIdx] = fullImageData.data[srcIdx];
								spriteImageData.data[dstIdx + 1] = fullImageData.data[srcIdx + 1];
								spriteImageData.data[dstIdx + 2] = fullImageData.data[srcIdx + 2];
								spriteImageData.data[dstIdx + 3] = fullImageData.data[srcIdx + 3];
							}
						}
					}

					// Check if sprite is empty (all transparent or magenta)
					let isEmpty = true;
					for (let i = 0; i < spriteImageData.data.length; i += 4) {
						const r = spriteImageData.data[i];
						const g = spriteImageData.data[i + 1];
						const b = spriteImageData.data[i + 2];
						const a = spriteImageData.data[i + 3];
						if (a > 0 && !(r === 255 && g === 0 && b === 255)) {
							isEmpty = false;
							break;
						}
					}

					if (!isEmpty || includeEmpty) {
						newSlices.push({
							imageData: spriteImageData,
							x,
							y,
							width: spriteSize,
							height: spriteSize,
						});
					}
				}
			}

			setSlices(newSlices);
			setIsProcessing(false);
		} catch (error: any) {
			showError(`Failed to cut sprites: ${error.message}`);
			setIsProcessing(false);
		}
	}, [image, offsetX, offsetY, spriteSize, columns, rows, includeEmpty, isProcessing, showError]);

	// Import sprites to project
	const handleImportSprites = useCallback(async () => {
		if (slices.length === 0) {
			showError('No sprites to import. Please cut sprites first.');
			return;
		}

		showProgress('Importing sprites...');
		try {
			// Convert ImageData to temporary files and import
			// For now, we'll use a canvas-based approach
			const tempFiles: string[] = [];
			const electronAPI = (window as any).electronAPI;

			for (let i = 0; i < slices.length; i++) {
				const slice = slices[i];
				const canvas = document.createElement('canvas');
				canvas.width = slice.width;
				canvas.height = slice.height;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					ctx.putImageData(slice.imageData, 0, 0);
					const dataUrl = canvas.toDataURL('image/png');
					
					// Convert data URL to blob and save temporarily
					const response = await fetch(dataUrl);
					const blob = await response.blob();
					const arrayBuffer = await blob.arrayBuffer();
					
					// Save to temp file via Electron
					if (electronAPI && electronAPI.writeTempFile) {
						const tempPath = await electronAPI.writeTempFile(`sprite_${i}.png`, arrayBuffer);
						tempFiles.push(tempPath);
					}
				}
			}

			if (tempFiles.length > 0) {
				const command = CommandFactory.createImportSpritesFromFilesCommand(tempFiles);
				const result = await worker.sendCommand(command);
				hideProgress();

				if (result.success) {
					showSuccess(`Successfully imported ${tempFiles.length} sprite(s)`);
					setSlices([]);
				} else {
					showError(result.error || 'Failed to import sprites');
				}
			} else {
				hideProgress();
				showError('Failed to create temporary sprite files');
			}
		} catch (error: any) {
			hideProgress();
			showError(error.message || 'Failed to import sprites');
			console.error('Import sprites error:', error);
		}
	}, [slices, worker, showProgress, hideProgress, showSuccess, showError]);

	// Handle grid drag
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (!image || !gridOverlayRef.current) return;
		const rect = gridOverlayRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		setIsDragging(true);
		setDragStart({ x, y });
	}, [image]);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (!isDragging || !dragStart || !image) return;
		const newX = Math.max(0, Math.min(image.width - (columns * spriteSize), offsetX + (e.clientX - dragStart.x) / zoom));
		const newY = Math.max(0, Math.min(image.height - (rows * spriteSize), offsetY + (e.clientY - dragStart.y) / zoom));
		setOffsetX(newX);
		setOffsetY(newY);
	}, [isDragging, dragStart, image, columns, rows, spriteSize, offsetX, offsetY, zoom]);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
		setDragStart(null);
	}, []);

	// Update max columns/rows when image or sprite size changes
	useEffect(() => {
		if (image && spriteSize > 0) {
			const maxCols = Math.floor(image.width / spriteSize);
			const maxRows = Math.floor(image.height / spriteSize);
			if (columns > maxCols) setColumns(maxCols);
			if (rows > maxRows) setRows(maxRows);
		}
	}, [image, spriteSize, columns, rows]);

	return (
		<div className="slicer">
			<div className="slicer-toolbar">
				<Button onClick={handleOpenFile}>Open Image</Button>
				<Button onClick={handleCutSprites} disabled={!image || isProcessing}>
					{isProcessing ? 'Processing...' : 'Cut Sprites'}
				</Button>
				<Button onClick={handleImportSprites} disabled={slices.length === 0}>
					Import Sprites ({slices.length})
				</Button>
			</div>

			<div className="slicer-content">
				{/* Controls Panel */}
				<div className="slicer-controls">
					<div className="control-group">
						<label>Sprite Size:</label>
						<input
							type="number"
							value={spriteSize}
							onChange={(e) => setSpriteSize(Math.max(32, parseInt(e.target.value) || 32))}
							min="32"
							step="32"
						/>
					</div>

					<div className="control-group">
						<label>Offset X:</label>
						<input
							type="number"
							value={offsetX}
							onChange={(e) => setOffsetX(Math.max(0, parseInt(e.target.value) || 0))}
							min="0"
						/>
					</div>

					<div className="control-group">
						<label>Offset Y:</label>
						<input
							type="number"
							value={offsetY}
							onChange={(e) => setOffsetY(Math.max(0, parseInt(e.target.value) || 0))}
							min="0"
						/>
					</div>

					<div className="control-group">
						<label>Columns:</label>
						<input
							type="number"
							value={columns}
							onChange={(e) => setColumns(Math.max(1, parseInt(e.target.value) || 1))}
							min="1"
							max={image ? Math.floor(image.width / spriteSize) : 100}
						/>
					</div>

					<div className="control-group">
						<label>Rows:</label>
						<input
							type="number"
							value={rows}
							onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
							min="1"
							max={image ? Math.floor(image.height / spriteSize) : 100}
						/>
					</div>

					<div className="control-group">
						<label>Zoom:</label>
						<input
							type="range"
							min="0.5"
							max="5.0"
							step="0.1"
							value={zoom}
							onChange={(e) => setZoom(parseFloat(e.target.value))}
						/>
						<span>{zoom.toFixed(1)}x</span>
					</div>

					<div className="control-group">
						<label>
							<input
								type="checkbox"
								checked={includeEmpty}
								onChange={(e) => setIncludeEmpty(e.target.checked)}
							/>
							Include Empty Sprites
						</label>
					</div>
				</div>

				{/* Image Display Area */}
				<div className="slicer-image-area">
					<div
						className="image-container"
						ref={imageContainerRef}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseUp}
					>
						{image && (
							<>
								<img
									src={image.src}
									alt="Sprite sheet"
									style={{
										transform: `scale(${zoom})`,
										transformOrigin: 'top left',
									}}
								/>
								<div
									className="grid-overlay"
									ref={gridOverlayRef}
									onMouseDown={handleMouseDown}
									style={{
										left: `${offsetX * zoom}px`,
										top: `${offsetY * zoom}px`,
										width: `${columns * spriteSize * zoom}px`,
										height: `${rows * spriteSize * zoom}px`,
									}}
								/>
							</>
						)}
						{!image && (
							<div className="image-placeholder">
								Drop an image here or click "Open Image" to load a sprite sheet
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

