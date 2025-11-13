import React, { useState, useRef } from 'react';
import { ThingList } from './ThingList';
import { ThingListPagination } from './ThingListPagination';
import { Panel } from './Panel';
import './Panel.css';

interface ThingsPanelProps {
	onClose: () => void;
}

export const ThingsPanel: React.FC<ThingsPanelProps> = ({ onClose }) => {
	const [pagination, setPagination] = useState<{
		totalCount: number;
		minId: number;
		maxId: number;
		currentMin: number;
		currentMax: number;
	} | null>(null);
	const navigateRef = useRef<((targetId: number) => void) | null>(null);

	const handleNavigate = (targetId: number) => {
		if (navigateRef.current) {
			navigateRef.current(targetId);
		}
	};

	return (
		<Panel
			title="Things Panel"
			className="things-panel"
			onClose={onClose}
			collapsible={true}
		>
			<div className="things-panel-content">
				<ThingList
					onPaginationChange={setPagination}
					onNavigate={(fn) => { navigateRef.current = fn; }}
				/>
				<ThingListPagination
					pagination={pagination}
					onNavigate={handleNavigate}
				/>
			</div>
		</Panel>
	);
};

