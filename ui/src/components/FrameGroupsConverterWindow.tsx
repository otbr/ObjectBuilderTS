import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { useWorker } from '../contexts/WorkerContext';
import { useProgress } from '../contexts/ProgressContext';
import { useToast } from '../hooks/useToast';
import { CommandFactory } from '../services/CommandFactory';
import './FrameGroupsConverterWindow.css';

interface FrameGroupsConverterWindowProps {
	open: boolean;
	onClose: () => void;
}

export const FrameGroupsConverterWindow: React.FC<FrameGroupsConverterWindowProps> = ({
	open,
	onClose,
}) => {
	const worker = useWorker();
	const { showProgress, hideProgress } = useProgress();
	const { showSuccess, showError } = useToast();
	const [isConverting, setIsConverting] = useState(false);
	const [frameGroups, setFrameGroups] = useState(true);
	const [removeMounts, setRemoveMounts] = useState(false);

	const handleConvert = async () => {
		if (isConverting) return;

		setIsConverting(true);
		showProgress('Converting frame groups...');

		try {
			const command = CommandFactory.createConvertFrameGroupsCommand(
				frameGroups,
				removeMounts
			);
			const result = await worker.sendCommand(command);

			hideProgress();
			setIsConverting(false);

			if (result.success) {
				showSuccess('Frame groups conversion complete!');
				onClose();
			} else {
				showError(result.error || 'Failed to convert frame groups');
			}
		} catch (error: any) {
			hideProgress();
			setIsConverting(false);
			showError(error.message || 'Failed to convert frame groups');
			console.error('Convert frame groups error:', error);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Frame Groups Converter"
			width={500}
			height={350}
		>
			<div className="frame-groups-converter-window">
				<div className="converter-content">
					<p>
						This tool will convert frame groups format for outfits:
					</p>
					<ul>
						<li>
							<strong>Add Frame Groups:</strong> Converts outfits from old format (without frame groups)
							to new format (with frame groups: DEFAULT, WALKING)
						</li>
						<li>
							<strong>Remove Frame Groups:</strong> Converts outfits from new format (with frame groups)
							to old format (without frame groups)
						</li>
					</ul>

					<div className="converter-options">
						<label className="option-group">
							<input
								type="radio"
								name="frameGroups"
								checked={frameGroups}
								onChange={() => setFrameGroups(true)}
							/>
							<span>Add Frame Groups</span>
						</label>
						<label className="option-group">
							<input
								type="radio"
								name="frameGroups"
								checked={!frameGroups}
								onChange={() => setFrameGroups(false)}
							/>
							<span>Remove Frame Groups</span>
						</label>
					</div>

					<div className="converter-options">
						<label className="option-group">
							<input
								type="checkbox"
								checked={removeMounts}
								onChange={(e) => setRemoveMounts(e.target.checked)}
							/>
							<span>Remove Mounts</span>
						</label>
					</div>

					<p className="warning-text">
						⚠️ This operation cannot be undone. Make sure you have saved your project.
					</p>
				</div>
				<div className="dialog-buttons">
					<Button
						variant="secondary"
						onClick={onClose}
						disabled={isConverting}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleConvert}
						disabled={isConverting}
					>
						{isConverting ? 'Converting...' : 'Convert Frame Groups'}
					</Button>
				</div>
			</div>
		</Dialog>
	);
};

