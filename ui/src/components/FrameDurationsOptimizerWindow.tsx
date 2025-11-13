import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { useWorker } from '../contexts/WorkerContext';
import { useProgress } from '../contexts/ProgressContext';
import { useToast } from '../hooks/useToast';
import { CommandFactory } from '../services/CommandFactory';
import './FrameDurationsOptimizerWindow.css';

interface FrameDurationsOptimizerWindowProps {
	open: boolean;
	onClose: () => void;
}

export const FrameDurationsOptimizerWindow: React.FC<FrameDurationsOptimizerWindowProps> = ({
	open,
	onClose,
}) => {
	const worker = useWorker();
	const { showProgress, hideProgress } = useProgress();
	const { showSuccess, showError } = useToast();
	const [isOptimizing, setIsOptimizing] = useState(false);

	// Items settings
	const [itemsEnabled, setItemsEnabled] = useState(false);
	const [itemsMinDuration, setItemsMinDuration] = useState(100);
	const [itemsMaxDuration, setItemsMaxDuration] = useState(200);

	// Outfits settings
	const [outfitsEnabled, setOutfitsEnabled] = useState(false);
	const [outfitsMinDuration, setOutfitsMinDuration] = useState(100);
	const [outfitsMaxDuration, setOutfitsMaxDuration] = useState(200);

	// Effects settings
	const [effectsEnabled, setEffectsEnabled] = useState(false);
	const [effectsMinDuration, setEffectsMinDuration] = useState(100);
	const [effectsMaxDuration, setEffectsMaxDuration] = useState(200);

	const handleOptimize = async () => {
		if (isOptimizing) return;

		if (!itemsEnabled && !outfitsEnabled && !effectsEnabled) {
			showError('Please enable at least one category to optimize');
			return;
		}

		setIsOptimizing(true);
		showProgress('Optimizing frame durations...');

		try {
			const command = CommandFactory.createOptimizeFrameDurationsCommand(
				itemsEnabled,
				itemsMinDuration,
				itemsMaxDuration,
				outfitsEnabled,
				outfitsMinDuration,
				outfitsMaxDuration,
				effectsEnabled,
				effectsMinDuration,
				effectsMaxDuration
			);
			const result = await worker.sendCommand(command);

			hideProgress();
			setIsOptimizing(false);

			if (result.success) {
				showSuccess('Frame durations optimization complete!');
				onClose();
			} else {
				showError(result.error || 'Failed to optimize frame durations');
			}
		} catch (error: any) {
			hideProgress();
			setIsOptimizing(false);
			showError(error.message || 'Failed to optimize frame durations');
			console.error('Optimize frame durations error:', error);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Frame Durations Optimizer"
			width={600}
			height={500}
		>
			<div className="frame-durations-optimizer-window">
				<div className="optimizer-content">
					<p>
						This tool will optimize animation frame durations by setting minimum and maximum
						duration values for selected categories.
					</p>

					{/* Items Section */}
					<div className="category-section">
						<label className="category-header">
							<input
								type="checkbox"
								checked={itemsEnabled}
								onChange={(e) => setItemsEnabled(e.target.checked)}
							/>
							<span>Items</span>
						</label>
						{itemsEnabled && (
							<div className="duration-controls">
								<div className="duration-control">
									<label>Minimum Duration (ms):</label>
									<input
										type="number"
										min="1"
										value={itemsMinDuration}
										onChange={(e) => setItemsMinDuration(Math.max(1, parseInt(e.target.value) || 1))}
									/>
								</div>
								<div className="duration-control">
									<label>Maximum Duration (ms):</label>
									<input
										type="number"
										min="1"
										value={itemsMaxDuration}
										onChange={(e) => setItemsMaxDuration(Math.max(1, parseInt(e.target.value) || 1))}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Outfits Section */}
					<div className="category-section">
						<label className="category-header">
							<input
								type="checkbox"
								checked={outfitsEnabled}
								onChange={(e) => setOutfitsEnabled(e.target.checked)}
							/>
							<span>Outfits</span>
						</label>
						{outfitsEnabled && (
							<div className="duration-controls">
								<div className="duration-control">
									<label>Minimum Duration (ms):</label>
									<input
										type="number"
										min="1"
										value={outfitsMinDuration}
										onChange={(e) => setOutfitsMinDuration(Math.max(1, parseInt(e.target.value) || 1))}
									/>
								</div>
								<div className="duration-control">
									<label>Maximum Duration (ms):</label>
									<input
										type="number"
										min="1"
										value={outfitsMaxDuration}
										onChange={(e) => setOutfitsMaxDuration(Math.max(1, parseInt(e.target.value) || 1))}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Effects Section */}
					<div className="category-section">
						<label className="category-header">
							<input
								type="checkbox"
								checked={effectsEnabled}
								onChange={(e) => setEffectsEnabled(e.target.checked)}
							/>
							<span>Effects</span>
						</label>
						{effectsEnabled && (
							<div className="duration-controls">
								<div className="duration-control">
									<label>Minimum Duration (ms):</label>
									<input
										type="number"
										min="1"
										value={effectsMinDuration}
										onChange={(e) => setEffectsMinDuration(Math.max(1, parseInt(e.target.value) || 1))}
									/>
								</div>
								<div className="duration-control">
									<label>Maximum Duration (ms):</label>
									<input
										type="number"
										min="1"
										value={effectsMaxDuration}
										onChange={(e) => setEffectsMaxDuration(Math.max(1, parseInt(e.target.value) || 1))}
									/>
								</div>
							</div>
						)}
					</div>

					<p className="warning-text">
						⚠️ This operation cannot be undone. Make sure you have saved your project.
					</p>
				</div>
				<div className="dialog-buttons">
					<Button
						variant="secondary"
						onClick={onClose}
						disabled={isOptimizing}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleOptimize}
						disabled={isOptimizing}
					>
						{isOptimizing ? 'Optimizing...' : 'Optimize Frame Durations'}
					</Button>
				</div>
			</div>
		</Dialog>
	);
};

