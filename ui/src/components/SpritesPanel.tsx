import React, { useState, useRef } from 'react';
import { SpriteList } from './SpriteList';
import { SpriteListPagination } from './SpriteListPagination';
import { Panel } from './Panel';
import './Panel.css';

interface SpritesPanelProps {
  onClose: () => void;
}

export const SpritesPanel: React.FC<SpritesPanelProps> = ({ onClose }) => {
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
      title="Sprites Panel"
      className="sprites-panel"
      onClose={onClose}
      collapsible={true}
    >
			<div className="sprites-panel-content">
				<SpriteList
					onPaginationChange={setPagination}
					onNavigate={(fn) => { navigateRef.current = fn; }}
				/>
				<SpriteListPagination
					pagination={pagination}
					onNavigate={handleNavigate}
				/>
			</div>
    </Panel>
  );
};

