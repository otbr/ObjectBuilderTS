import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { LookType } from '../utils/LookType';
import { Button } from './Button';
import { PreviewCanvas } from './PreviewCanvas';
import { HSIColorPicker } from './HSIColorPicker';
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
	const prevOutfitDataRef = useRef<{ head: number; body: number; legs: number; feet: number; addons: number } | null>(null);
	const pendingThingRequestRef = useRef<{ id: number; category: string; timeout?: NodeJS.Timeout } | null>(null);

	// Update XML when lookType changes
	useEffect(() => {
		const xml = lookType.serialize();
		setXmlOutput(xml || '');
	}, [lookType]);

	// Listen for SetThingDataCommand responses
	useEffect(() => {
		const handleCommand = (command: any) => {
			if (command.type === 'SetThingDataCommand') {
				const thingData = command.data;
				if (thingData && thingData.thing) {
					const thingId = thingData.thing.id;
					const thingCategory = thingData.thing.category;
					
					// Check if this is the thing we're waiting for
					if (pendingThingRequestRef.current &&
						pendingThingRequestRef.current.id === thingId &&
						pendingThingRequestRef.current.category === thingCategory) {
						// Clear timeout if it exists
						if (pendingThingRequestRef.current.timeout) {
							clearTimeout(pendingThingRequestRef.current.timeout);
						}
						
						// Clear pending request
						pendingThingRequestRef.current = null;
						
						// Create a modified thingData with outfit colors (only for outfits)
						const modifiedThingData = { ...thingData };
						if (modifiedThingData.thing && !isItem && thingCategory === 'outfit') {
							// Apply outfit colors - we'll update these in a separate effect when colors change
							modifiedThingData.outfitData = {
								head: lookType.head,
								body: lookType.body,
								legs: lookType.legs,
								feet: lookType.feet,
								addons: lookType.addons,
							};
						}
						setPreviewThingData(modifiedThingData);
						setLoadingPreview(false);
					}
				}
			}
		};

		worker.onCommand(handleCommand);
		
		// Note: We don't remove the listener here because WorkerContext doesn't expose removeListener
		// The listener will stop being called when the component unmounts
		// This is the same pattern used in ThingEditor
	}, [worker, isItem, lookType]);

	// Load preview outfit when outfit/item changes
	useEffect(() => {
		const loadPreview = async () => {
			if (!clientInfo?.loaded) {
				setPreviewThingData(null);
				pendingThingRequestRef.current = null;
				return;
			}

			const thingId = isItem ? lookType.item : lookType.outfit;
			if (!thingId || thingId === 0) {
				setPreviewThingData(null);
				pendingThingRequestRef.current = null;
				return;
			}

			setLoadingPreview(true);
			try {
				// Use the correct category based on whether it's an item or outfit
				const category = isItem ? 'item' : 'outfit';
				
				// Clear any existing pending request and its timeout
				if (pendingThingRequestRef.current?.timeout) {
					clearTimeout(pendingThingRequestRef.current.timeout);
				}
				
				// Set a timeout to clear loading state if no response comes
				const timeout = setTimeout(() => {
					if (pendingThingRequestRef.current &&
						pendingThingRequestRef.current.id === thingId &&
						pendingThingRequestRef.current.category === category) {
						console.warn(`Timeout waiting for thing data: ${category} ${thingId}`);
						setPreviewThingData(null);
						setLoadingPreview(false);
						pendingThingRequestRef.current = null;
					}
				}, 5000); // 5 second timeout
				
				// Store pending request with timeout so we can match the response and clear timeout
				pendingThingRequestRef.current = { id: thingId, category, timeout };
				
				// Send command - response will come via SetThingDataCommand event
				const command = CommandFactory.createGetThingCommand(thingId, category);
				await worker.sendCommand(command);
			} catch (error: any) {
				console.error('Failed to load preview:', error);
				setPreviewThingData(null);
				setLoadingPreview(false);
				if (pendingThingRequestRef.current?.timeout) {
					clearTimeout(pendingThingRequestRef.current.timeout);
				}
				pendingThingRequestRef.current = null;
			}
		};

		loadPreview();
	}, [lookType.outfit, lookType.item, isItem, clientInfo, worker]);

	// Update outfit colors in preview when they change (without reloading the thing)
	useEffect(() => {
		if (previewThingData && previewThingData.thing && !isItem) {
			const newOutfitData = {
				head: lookType.head,
				body: lookType.body,
				legs: lookType.legs,
				feet: lookType.feet,
				addons: lookType.addons,
			};
			
			// Only update if outfitData actually changed to avoid unnecessary re-renders
			const prev = prevOutfitDataRef.current;
			if (!prev ||
				prev.head !== newOutfitData.head ||
				prev.body !== newOutfitData.body ||
				prev.legs !== newOutfitData.legs ||
				prev.feet !== newOutfitData.feet ||
				prev.addons !== newOutfitData.addons) {
				// Update outfitData in existing previewThingData
				setPreviewThingData({
					...previewThingData,
					outfitData: newOutfitData,
				});
				prevOutfitDataRef.current = newOutfitData;
			}
		} else {
			prevOutfitDataRef.current = null;
		}
	}, [lookType.head, lookType.body, lookType.legs, lookType.feet, lookType.addons, isItem, previewThingData]);

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
									patternX={(() => {
										// For outfits, use patternX=2 if available, otherwise 0
										if (!isItem && previewThingData?.thing?.frameGroups?.[0]) {
											const frameGroup = previewThingData.thing.frameGroups[0];
											return frameGroup.patternX > 1 ? 2 : 0;
										}
										return 0;
									})()}
									patternY={(() => {
										// Convert addons bitmask to patternY index
										// Addons is a bitmask where bit 0 = addon 1, bit 1 = addon 2
										// patternY represents which addon layer to show (0 = base, 1 = addon 1, 2 = addon 2, etc.)
										if (!isItem && lookType.addons > 0) {
											// Find the highest enabled addon bit
											let highestAddon = 0;
											for (let i = 0; i < 3; i++) {
												if (lookType.addons & (1 << i)) {
													highestAddon = i + 1;
												}
											}
											return highestAddon;
										}
										return 0;
									})()}
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
								<HSIColorPicker
									color={lookType.head}
									onChange={(color) => updateProperty('head', color)}
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
								<HSIColorPicker
									color={lookType.body}
									onChange={(color) => updateProperty('body', color)}
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
								<HSIColorPicker
									color={lookType.legs}
									onChange={(color) => updateProperty('legs', color)}
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
								<HSIColorPicker
									color={lookType.feet}
									onChange={(color) => updateProperty('feet', color)}
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

