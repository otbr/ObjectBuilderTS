import React, { useState, useRef, useEffect, useCallback } from 'react';
import './HSIColorPanel.css';

interface HSIColorPanelProps {
	selectedIndex: number;
	onColorChange: (index: number) => void;
	columns?: number;
	rows?: number;
}

// HSI to RGB conversion function (from ColorUtils)
function HSItoRGB(color: number): number {
	const values = 7;
	const steps = 19;
	let H = 0;
	let S = 0;
	let I = 0;
	let R = 0;
	let G = 0;
	let B = 0;

	if (color >= steps * values) {
		color = 0;
	}

	if (color % steps === 0) {
		H = 0;
		S = 0;
		I = 1 - color / steps / values;
	} else {
		H = (color % steps) * (1 / 18);
		S = 1;
		I = 1;

		switch (Math.floor(color / steps)) {
			case 0:
				S = 0.25;
				I = 1;
				break;
			case 1:
				S = 0.25;
				I = 0.75;
				break;
			case 2:
				S = 0.5;
				I = 0.75;
				break;
			case 3:
				S = 0.667;
				I = 0.75;
				break;
			case 4:
				S = 1;
				I = 1;
				break;
			case 5:
				S = 1;
				I = 0.75;
				break;
			case 6:
				S = 1;
				I = 0.5;
				break;
		}
	}

	if (I === 0) {
		return 0x000000;
	}

	if (S === 0) {
		return (Math.floor(I * 0xFF) << 16) | (Math.floor(I * 0xFF) << 8) | Math.floor(I * 0xFF);
	}

	if (H < 1 / 6) {
		R = I;
		B = I * (1 - S);
		G = B + (I - B) * 6 * H;
	} else if (H < 2 / 6) {
		G = I;
		B = I * (1 - S);
		R = G - (I - B) * (6 * H - 1);
	} else if (H < 3 / 6) {
		G = I;
		R = I * (1 - S);
		B = R + (I - R) * (6 * H - 2);
	} else if (H < 4 / 6) {
		B = I;
		R = I * (1 - S);
		G = B - (I - R) * (6 * H - 3);
	} else if (H < 5 / 6) {
		B = I;
		G = I * (1 - S);
		R = G + (I - G) * (6 * H - 4);
	} else {
		R = I;
		G = I * (1 - S);
		B = R - (I - G) * (6 * H - 5);
	}
	return (Math.floor(R * 0xFF) << 16) | (Math.floor(G * 0xFF) << 8) | Math.floor(B * 0xFF);
}

function rgbToHex(rgb: number): string {
	const r = (rgb >> 16) & 0xFF;
	const g = (rgb >> 8) & 0xFF;
	const b = rgb & 0xFF;
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const HSIColorPanel: React.FC<HSIColorPanelProps> = ({
	selectedIndex,
	onColorChange,
	columns = 19,
	rows = 7,
}) => {
	const [hoverIndex, setHoverIndex] = useState<number>(-1);
	const panelRef = useRef<HTMLDivElement>(null);
	const swatchWidth = 15;
	const swatchHeight = 15;
	const swatchGap = 1;
	const length = columns * rows;

	const getColor = useCallback((colorIndex: number): string => {
		const rgb = HSItoRGB(colorIndex);
		return rgbToHex(rgb);
	}, []);

	const getSwatchPosition = useCallback((index: number) => {
		const row = Math.floor(index / columns);
		const col = index % columns;
		return {
			left: col * (swatchWidth + swatchGap),
			top: row * (swatchHeight + swatchGap),
		};
	}, [columns, swatchWidth, swatchHeight, swatchGap]);

	const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!panelRef.current) return;

		const rect = panelRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const col = Math.floor(x / (swatchWidth + swatchGap));
		const row = Math.floor(y / (swatchHeight + swatchGap));

		if (col >= 0 && col < columns && row >= 0 && row < rows) {
			const index = row * columns + col;
			if (index >= 0 && index < length) {
				setHoverIndex(index);
			} else {
				setHoverIndex(-1);
			}
		} else {
			setHoverIndex(-1);
		}
	}, [columns, rows, length, swatchWidth, swatchHeight, swatchGap]);

	const handleMouseLeave = useCallback(() => {
		setHoverIndex(-1);
	}, []);

	const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!panelRef.current) return;

		const rect = panelRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const col = Math.floor(x / (swatchWidth + swatchGap));
		const row = Math.floor(y / (swatchHeight + swatchGap));

		if (col >= 0 && col < columns && row >= 0 && row < rows) {
			const index = row * columns + col;
			if (index >= 0 && index < length) {
				onColorChange(index);
			}
		}
	}, [columns, rows, length, onColorChange, swatchWidth, swatchHeight, swatchGap]);

	const selectedPos = getSwatchPosition(selectedIndex);
	const hoverPos = hoverIndex >= 0 ? getSwatchPosition(hoverIndex) : null;

	return (
		<div
			ref={panelRef}
			className="hsi-color-panel"
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			onClick={handleClick}
			style={{
				width: columns * (swatchWidth + swatchGap),
				height: rows * (swatchHeight + swatchGap),
			}}
		>
			{Array.from({ length }, (_, i) => {
				const pos = getSwatchPosition(i);
				return (
					<div
						key={i}
						className="hsi-color-swatch"
						style={{
							left: `${pos.left}px`,
							top: `${pos.top}px`,
							width: `${swatchWidth}px`,
							height: `${swatchHeight}px`,
							backgroundColor: getColor(i),
						}}
					/>
				);
			})}
			{hoverPos && hoverIndex !== selectedIndex && (
				<div
					className="hsi-color-highlight"
					style={{
						left: `${hoverPos.left}px`,
						top: `${hoverPos.top}px`,
						width: `${swatchWidth}px`,
						height: `${swatchHeight}px`,
					}}
				/>
			)}
			{selectedIndex >= 0 && selectedIndex < length && (
				<div
					className="hsi-color-selection"
					style={{
						left: `${selectedPos.left}px`,
						top: `${selectedPos.top}px`,
						width: `${swatchWidth}px`,
						height: `${swatchHeight}px`,
					}}
				/>
			)}
		</div>
	);
};

