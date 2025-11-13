import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { useWorker } from '../contexts/WorkerContext';
import { useProgress } from '../contexts/ProgressContext';
import { useToast } from '../hooks/useToast';
import { CommandFactory } from '../services/CommandFactory';
import './SpritesOptimizerWindow.css';

interface SpritesOptimizerWindowProps {
	open: boolean;
	onClose: () => void;
}

export const SpritesOptimizerWindow: React.FC<SpritesOptimizerWindowProps> = ({
	open,
	onClose,
}) => {
	const worker = useWorker();
	const { showProgress, hideProgress } = useProgress();
	const { showSuccess, showError } = useToast();
	const [isOptimizing, setIsOptimizing] = useState(false);

	const handleOptimize = async () => {
		if (isOptimizing) return;

		setIsOptimizing(true);
		showProgress('Optimizing sprites...');

		try {
			const command = CommandFactory.createOptimizeSpritesCommand();
			const result = await worker.sendCommand(command);

			hideProgress();
			setIsOptimizing(false);

			if (result.success) {
				const removedCount = result.removedCount || 0;
				const oldCount = result.oldCount || 0;
				const newCount = result.newCount || 0;
				showSuccess(
					`Optimization complete! Removed ${removedCount} duplicate sprite(s). ` +
					`Total sprites: ${oldCount} → ${newCount}`
				);
				onClose();
			} else {
				showError(result.error || 'Failed to optimize sprites');
			}
		} catch (error: any) {
			hideProgress();
			setIsOptimizing(false);
			showError(error.message || 'Failed to optimize sprites');
			console.error('Optimize sprites error:', error);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Sprites Optimizer"
			width={500}
			height={300}
		>
			<div className="sprites-optimizer-window">
				<div className="optimizer-content">
					<p>
						This tool will optimize your sprite storage by:
					</p>
					<ul>
						<li>Removing duplicate sprites</li>
						<li>Replacing duplicate references with single instances</li>
						<li>Removing unused sprites (if any)</li>
					</ul>
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
						{isOptimizing ? 'Optimizing...' : 'Optimize Sprites'}
					</Button>
				</div>
			</div>
		</Dialog>
	);
};

