import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { LookType } from '../utils/LookType';
import { Button } from './Button';
import { PreviewCanvas } from './PreviewCanvas';
import { useToast } from '../hooks/useToast';
import { useWorker } from '../contexts/WorkerContext';
import { useAppStateContext } from '../contexts/AppStateContext';
import { CommandFactory } from '../services/CommandFactory';
import './LookGenerator.css';

interface LookGeneratorProps {
	onClose?: () => void;
}

const LookGeneratorComponent: React.FC<LookGeneratorProps> = ({ onClose }) => {
	const { showError, showSuccess } = useToast();
	const worker = useWorker();
	const { clientInfo } = useAppStateContext();
	const [lookType, setLookType] = useState<LookType>(new LookType());
	const [xmlOutput, setXmlOutput] = useState<string>('');
	const [isItem, setIsItem] = useState<boolean>(false);
	const [previewThingData, setPreviewThingData] = useState<any>(null);
	const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

	// Update XML when lookType changes
	useEffect(() => {
		const xml = lookType.serialize();
		setXmlOutput(xml || '');
	}, [lookType]);

	// Load preview outfit when outfit/item changes
	useEffect(() => {
		const loadPreview = async () => {
			if (!clientInfo?.loaded) {
				setPreviewThingData(null);
				return;
			}

			const thingId = isItem ? lookType.item : lookType.outfit;
			if (!thingId || thingId === 0) {
				setPreviewThingData(null);
				return;
			}

			setLoadingPreview(true);
			try {
				// Use the correct category based on whether it's an item or outfit
				const category = isItem ? 'item' : 'outfit';
				const command = CommandFactory.createGetThingCommand(thingId, category);
				const result = await worker.sendCommand(command);
				
				if (result.success && result.data) {
					// Create a modified thingData with outfit colors (only for outfits)
					const thingData = { ...result.data };
					if (thingData.thing && !isItem) {
						// Apply outfit colors if available (only for outfits, not items)
						thingData.outfitData = {
							head: lookType.head,
							body: lookType.body,
							legs: lookType.legs,
							feet: lookType.feet,
							addons: lookType.addons,
						};
					}
					setPreviewThingData(thingData);
				} else {
					console.log('Preview load result:', result);
					setPreviewThingData(null);
				}
			} catch (error: any) {
				console.error('Failed to load preview:', error);
				setPreviewThingData(null);
			} finally {
				setLoadingPreview(false);
			}
		};

		loadPreview();
	}, [lookType.outfit, lookType.item, isItem, clientInfo, worker]);

	// Handle type change (outfit/item)
	const handleTypeChange = useCallback((value: number) => {
		const newLookType = new LookType();
		newLookType.outfit = lookType.outfit;
		newLookType.item = lookType.item;
		newLookType.head = lookType.head;
		newLookType.body = lookType.body;
		newLookType.legs = lookType.legs;
		newLookType.feet = lookType.feet;
		newLookType.addons = lookType.addons;
		newLookType.mount = lookType.mount;
		newLookType.corpse = lookType.corpse;
		if (isItem) {
			newLookType.outfit = 0;
			newLookType.item = value;
		} else {
			newLookType.item = 0;
			newLookType.outfit = value;
		}
		setLookType(newLookType);
	}, [lookType, isItem]);

	// Handle item/outfit toggle
	const handleItemToggle = useCallback((checked: boolean) => {
		const newLookType = new LookType();
		newLookType.outfit = lookType.outfit;
		newLookType.item = lookType.item;
		newLookType.head = lookType.head;
		newLookType.body = lookType.body;
		newLookType.legs = lookType.legs;
		newLookType.feet = lookType.feet;
		newLookType.addons = lookType.addons;
		newLookType.mount = lookType.mount;
		newLookType.corpse = lookType.corpse;
		const value = checked ? newLookType.outfit : newLookType.item;
		if (checked) {
			newLookType.outfit = 0;
			newLookType.item = value;
		} else {
			newLookType.item = 0;
			newLookType.outfit = value;
		}
		setIsItem(checked);
		setLookType(newLookType);
	}, [lookType]);

	// Copy XML to clipboard
	const handleCopy = useCallback(async () => {
		if (!xmlOutput) return;

		try {
			await navigator.clipboard.writeText(xmlOutput);
			showSuccess('XML copied to clipboard');
		} catch (error: any) {
			showError('Failed to copy to clipboard: ' + error.message);
		}
	}, [xmlOutput, showSuccess, showError]);

	// Paste XML from clipboard
	const handlePaste = useCallback(async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (!text) return;

			const newLookType = new LookType();
			newLookType.unserialize(text);
			setLookType(newLookType);
			setIsItem(newLookType.item !== 0);
			showSuccess('XML pasted successfully');
		} catch (error: any) {
			showError('Failed to paste XML: ' + error.message);
		}
	}, [showSuccess, showError]);

	// Update property helper
	const updateProperty = useCallback((property: keyof LookType, value: number) => {
		const newLookType = new LookType();
		newLookType.outfit = lookType.outfit;
		newLookType.item = lookType.item;
		newLookType.head = lookType.head;
		newLookType.body = lookType.body;
		newLookType.legs = lookType.legs;
		newLookType.feet = lookType.feet;
		newLookType.addons = lookType.addons;
		newLookType.mount = lookType.mount;
		newLookType.corpse = lookType.corpse;
		(newLookType as any)[property] = value;
		setLookType(newLookType);
	}, [lookType]);

	return (
		<div className="look-generator-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
			<div className="look-generator-window" onClick={(e) => e.stopPropagation()}>
				<div className="look-generator-header">
					<h2>Look Type Generator</h2>
					<button className="close-button" onClick={onClose}>×</button>
				</div>

				<div className="look-generator-content">
					{/* Preview Section */}
					<div className="look-generator-group look-preview-group">
						<h3>Preview</h3>
						<div className="look-preview-container">
							{loadingPreview ? (
								<div className="look-preview-loading">Loading...</div>
							) : previewThingData ? (
								<PreviewCanvas
									thingData={previewThingData}
									width={128}
									height={128}
									frameGroupType={0}
									patternX={2}
									patternY={0}
									patternZ={0}
									animate={false}
									zoom={1}
									backgroundColor="#494949"
								/>
							) : (
								<div className="look-preview-placeholder">
									<p>No preview available</p>
									<p className="preview-hint">
										{clientInfo?.loaded 
											? (isItem ? lookType.item === 0 : lookType.outfit === 0)
												? `Enter an ${isItem ? 'item' : 'outfit'} ID to see preview`
												: `Outfit/item not found or invalid`
											: 'Load a project to see preview'}
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Look Type Controls */}
					<div className="look-generator-group">
						<h3>Look Type</h3>
						<div className="look-controls">
							<div className="control-row">
								<label>Type:</label>
								<input
									type="number"
									value={isItem ? lookType.item : lookType.outfit}
									onChange={(e) => handleTypeChange(parseInt(e.target.value, 10) || 0)}
									min={0}
									max={0xFFFFFF}
									className="numeric-input"
								/>
								<label className="checkbox-label">
									<input
										type="checkbox"
										checked={isItem}
										onChange={(e) => handleItemToggle(e.target.checked)}
									/>
									As Item
								</label>
							</div>

							<div className="control-row">
								<label>Head:</label>
								<input
									type="number"
									value={lookType.head}
									onChange={(e) => updateProperty('head', parseInt(e.target.value, 10) || 0)}
									min={0}
									max={132}
									className="numeric-input"
								/>
								<input
									type="color"
									value={`#${Math.min(255, lookType.head).toString(16).padStart(2, '0').repeat(3)}`}
									onChange={(e) => {
										// Color picker returns RGB, but we need to use it as a simple value
										// For now, just use the numeric input for head/body/legs/feet
										// The color picker is a visual aid
									}}
									className="color-input"
									disabled
									title="Color picker for HSI colors - use numeric input for now"
								/>
							</div>

							<div className="control-row">
								<label>Body:</label>
								<input
									type="number"
									value={lookType.body}
									onChange={(e) => updateProperty('body', parseInt(e.target.value, 10) || 0)}
									min={0}
									max={132}
									className="numeric-input"
								/>
								<input
									type="color"
									value={`#${Math.min(255, lookType.body).toString(16).padStart(2, '0').repeat(3)}`}
									onChange={(e) => {}}
									className="color-input"
									disabled
									title="Color picker for HSI colors - use numeric input for now"
								/>
							</div>

							<div className="control-row">
								<label>Legs:</label>
								<input
									type="number"
									value={lookType.legs}
									onChange={(e) => updateProperty('legs', parseInt(e.target.value, 10) || 0)}
									min={0}
									max={132}
									className="numeric-input"
								/>
								<input
									type="color"
									value={`#${Math.min(255, lookType.legs).toString(16).padStart(2, '0').repeat(3)}`}
									onChange={(e) => {}}
									className="color-input"
									disabled
									title="Color picker for HSI colors - use numeric input for now"
								/>
							</div>

							<div className="control-row">
								<label>Feet:</label>
								<input
									type="number"
									value={lookType.feet}
									onChange={(e) => updateProperty('feet', parseInt(e.target.value, 10) || 0)}
									min={0}
									max={132}
									className="numeric-input"
								/>
								<input
									type="color"
									value={`#${Math.min(255, lookType.feet).toString(16).padStart(2, '0').repeat(3)}`}
									onChange={(e) => {}}
									className="color-input"
									disabled
									title="Color picker for HSI colors - use numeric input for now"
								/>
							</div>

							<div className="control-row">
								<label>Addons:</label>
								<input
									type="number"
									value={lookType.addons}
									onChange={(e) => updateProperty('addons', parseInt(e.target.value, 10) || 0)}
									min={0}
									max={3}
									className="numeric-input"
								/>
							</div>

							<div className="control-row">
								<label>Mount:</label>
								<input
									type="number"
									value={lookType.mount}
									onChange={(e) => updateProperty('mount', parseInt(e.target.value, 10) || 0)}
									min={0}
									max={0xFFFFFF}
									className="numeric-input"
								/>
							</div>

							<div className="control-row">
								<label>Corpse:</label>
								<input
									type="number"
									value={lookType.corpse}
									onChange={(e) => updateProperty('corpse', parseInt(e.target.value, 10) || 0)}
									min={0}
									max={0xFFFFFF}
									className="numeric-input"
								/>
							</div>
						</div>
					</div>

					{/* XML Output */}
					<div className="look-generator-group">
						<h3>XML</h3>
						<textarea
							className="xml-display"
							value={xmlOutput}
							readOnly
							placeholder="XML will appear here..."
						/>
					</div>
				</div>

				{/* Footer */}
				<div className="look-generator-footer">
					<Button onClick={handleCopy} disabled={!xmlOutput}>Copy</Button>
					<Button onClick={handlePaste}>Paste</Button>
					<Button onClick={onClose}>Close</Button>
				</div>
			</div>
		</div>
	);
};

export const LookGenerator = memo(LookGeneratorComponent);

