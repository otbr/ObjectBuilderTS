import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HSIColorPanel } from './HSIColorPanel';
import './HSIColorPicker.css';

interface HSIColorPickerProps {
	color: number;
	onChange: (color: number) => void;
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

export const HSIColorPicker: React.FC<HSIColorPickerProps> = ({ color, onChange }) => {
	const [isOpen, setIsOpen] = useState(false);
	const pickerRef = useRef<HTMLDivElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);

	const rgb = HSItoRGB(color);
	const hexColor = rgbToHex(rgb);

	const handleClick = useCallback(() => {
		setIsOpen(true);
	}, []);

	const handleColorChange = useCallback((newColor: number) => {
		onChange(newColor);
		setIsOpen(false);
	}, [onChange]);

	// Close popup when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				pickerRef.current &&
				popupRef.current &&
				!pickerRef.current.contains(event.target as Node) &&
				!popupRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="hsi-color-picker" ref={pickerRef}>
			<button
				type="button"
				className="hsi-color-picker-button"
				onClick={handleClick}
				style={{ backgroundColor: hexColor }}
				title={`HSI Color: ${color}`}
			/>
			{isOpen && (
				<div className="hsi-color-picker-popup" ref={popupRef}>
					<HSIColorPanel
						selectedIndex={color}
						onColorChange={handleColorChange}
					/>
				</div>
			)}
		</div>
	);
};

