import React, { useState, useCallback } from 'react';
import { FileDialogService } from '../services/FileDialogService';
import { PreviewCanvas } from './PreviewCanvas';
import { Button } from './Button';
import { useToast } from '../hooks/useToast';
import './ImportThingWindow.css';

interface ImportThingWindowProps {
	open: boolean;
	onClose: () => void;
	onConfirm: (thingData: any, filePath: string) => void;
}

export const ImportThingWindow: React.FC<ImportThingWindowProps> = ({ open, onClose, onConfirm }) => {
	const { showError } = useToast();
	const [filePath, setFilePath] = useState<string>('');
	const [thingData, setThingData] = useState<any>(null);
	const [category, setCategory] = useState<string>('');
	const [version, setVersion] = useState<string>('');
	const [loading, setLoading] = useState(false);

	const electronAPI = (window as any).electronAPI;

	const handleBrowse = useCallback(async () => {
		try {
			const fileDialog = FileDialogService.getInstance();
			const result = await fileDialog.openOBDFile();

			if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
				const selectedPath = result.filePaths[0];
				setFilePath(selectedPath);
				setThingData(null);
				setCategory('');
				setVersion('');
				setLoading(true);

				// Load OBD file
				if (electronAPI && electronAPI.loadOBDFile) {
					const loadResult = await electronAPI.loadOBDFile(selectedPath);
					
					if (loadResult.success && loadResult.data) {
						setThingData(loadResult.data);
						
						// Extract category
						if (loadResult.data.thing && loadResult.data.thing.category) {
							const cat = loadResult.data.thing.category;
							setCategory(cat.charAt(0).toUpperCase() + cat.slice(1));
						}

						// Extract version info
						// Version is stored in clientVersion, format as X.XX
						if (loadResult.data.clientVersion) {
							const v = loadResult.data.clientVersion;
							setVersion(`${Math.floor(v / 100)}.${v % 100}`);
						}
					} else {
						showError(loadResult.error || 'Failed to load OBD file');
						setFilePath('');
					}
				} else {
					showError('File loading not available');
					setFilePath('');
				}
			}
		} catch (error: any) {
			showError(error.message || 'Failed to browse file');
			setFilePath('');
		} finally {
			setLoading(false);
		}
	}, [electronAPI, showError]);

	const handleConfirm = useCallback(() => {
		if (thingData && filePath) {
			onConfirm(thingData, filePath);
			onClose();
		}
	}, [thingData, filePath, onConfirm, onClose]);

	const handleCancel = useCallback(() => {
		setFilePath('');
		setThingData(null);
		setCategory('');
		setVersion('');
		onClose();
	}, [onClose]);

	if (!open) return null;

	return (
		<div className="import-thing-window-overlay" onClick={(e) => e.target === e.currentTarget && handleCancel()}>
			<div className="import-thing-window" onClick={(e) => e.stopPropagation()}>
				<div className="import-thing-header">
					<h2>Import Object</h2>
					<button className="close-button" onClick={handleCancel}>×</button>
				</div>

				<div className="import-thing-content">
					{/* File Selection */}
					<div className="import-thing-file-group">
						<label>File:</label>
						<div className="file-input-group">
							<input
								type="text"
								value={filePath}
								readOnly
								className="file-path-input"
								placeholder="No file selected"
							/>
							<Button onClick={handleBrowse}>Browse</Button>
						</div>
					</div>

					{/* Preview */}
					<div className="import-thing-preview-group">
						<h3>Preview</h3>
						<div className="preview-info">
							{category && (
								<div className="info-row">
									<span className="info-label">Type:</span>
									<span className="info-value">{category}</span>
								</div>
							)}
							{version && (
								<div className="info-row">
									<span className="info-label">Version:</span>
									<span className="info-value">{version}</span>
								</div>
							)}
						</div>
						<div className="preview-canvas-container">
							{loading ? (
								<div className="preview-loading">
									<div className="loading-spinner"></div>
									<p>Loading...</p>
								</div>
							) : thingData ? (
								<PreviewCanvas
									thingData={thingData}
									width={128}
									height={128}
									frameGroupType={0}
									patternX={0}
									patternY={0}
									patternZ={0}
									animate={false}
									zoom={1}
								/>
							) : (
								<div className="preview-placeholder">
									<p>No preview available</p>
									<p className="preview-hint">Select an OBD file to preview</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="import-thing-footer">
					<Button onClick={handleConfirm} disabled={!thingData || loading}>
						Confirm
					</Button>
					<Button onClick={handleCancel}>Cancel</Button>
				</div>
			</div>
		</div>
	);
};

