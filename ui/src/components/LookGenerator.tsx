import React, { useState, useEffect, useCallback } from 'react';
import { LookType } from '../utils/LookType';
import { Button } from './Button';
import { useToast } from '../hooks/useToast';
import './LookGenerator.css';

interface LookGeneratorProps {
	onClose?: () => void;
}

export const LookGenerator: React.FC<LookGeneratorProps> = ({ onClose }) => {
	const { showError, showSuccess } = useToast();
	const [lookType, setLookType] = useState<LookType>(new LookType());
	const [xmlOutput, setXmlOutput] = useState<string>('');
	const [isItem, setIsItem] = useState<boolean>(false);

	// Update XML when lookType changes
	useEffect(() => {
		const xml = lookType.serialize();
		setXmlOutput(xml || '');
	}, [lookType]);

	// Handle type change (outfit/item)
	const handleTypeChange = useCallback((value: number) => {
		const newLookType = { ...lookType };
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
		const newLookType = { ...lookType };
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
		setLookType({ ...lookType, [property]: value });
	}, [lookType]);

	return (
		<div className="look-generator-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
			<div className="look-generator-window" onClick={(e) => e.stopPropagation()}>
				<div className="look-generator-header">
					<h2>Look Type Generator</h2>
					<button className="close-button" onClick={onClose}>×</button>
				</div>

				<div className="look-generator-content">
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

