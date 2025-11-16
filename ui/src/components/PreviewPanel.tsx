import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useWorker } from '../contexts/WorkerContext';
import { PreviewCanvas } from './PreviewCanvas';
import { Panel } from './Panel';
import './Panel.css';

interface PreviewPanelProps {
  onClose: () => void;
}

const PreviewPanelComponent: React.FC<PreviewPanelProps> = ({ onClose }) => {
  const worker = useWorker();
  const [thingData, setThingData] = useState<any>(null);
  const [frameGroupType, setFrameGroupType] = useState(0); // DEFAULT
  const [patternX, setPatternX] = useState(0);
  const [patternY, setPatternY] = useState(0);
  const [patternZ, setPatternZ] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [showAllPatterns, setShowAllPatterns] = useState(false);
	const [backgroundColor, setBackgroundColor] = useState('#494949');
	const [showGrid, setShowGrid] = useState(false);
	const [panX, setPanX] = useState(0);
	const [panY, setPanY] = useState(0);
	const canvasSectionRef = useRef<HTMLDivElement>(null);

  // Listen for SetThingDataCommand to update preview
  useEffect(() => {
    const handleCommand = (command: any) => {
      if (command.type === 'SetThingDataCommand') {
        setThingData(command.data);
        // Reset pattern values when thing changes
        setPatternX(0);
        setPatternY(0);
        setPatternZ(0);
        setFrameGroupType(0); // DEFAULT
      }
    };

    worker.onCommand(handleCommand);
  }, [worker]);

  // Memoize computed values to avoid recalculation
  const frameGroups = useMemo(() => thingData?.thing?.frameGroups || [], [thingData?.thing?.frameGroups]);
  
  const availableFrameGroups: { type: number; name: string }[] = useMemo(() => {
    const groups: { type: number; name: string }[] = [];
    if (frameGroups[0]) groups.push({ type: 0, name: 'Default' });
    if (frameGroups[1]) groups.push({ type: 1, name: 'Walking' });
    return groups;
  }, [frameGroups]);

  const frameGroup = useMemo(() => thingData?.thing?.frameGroups?.[frameGroupType], [thingData?.thing?.frameGroups, frameGroupType]);
  
  const hasAnimation = useMemo(() => frameGroup?.isAnimation || false, [frameGroup?.isAnimation]);
  const totalFrames = useMemo(() => frameGroup?.frames || 1, [frameGroup?.frames]);
  
  const spriteCount = useMemo(() => {
    if (!thingData?.sprites) return 0;
    if (thingData.sprites instanceof Map) {
      return thingData.sprites.get(frameGroupType)?.length || 0;
    }
    if (Array.isArray(thingData.sprites)) {
      return thingData.sprites.length;
    }
    return Object.keys(thingData.sprites).length;
  }, [thingData?.sprites, frameGroupType]);

  // Frame navigation handlers - memoized
  const handlePreviousFrame = useCallback(() => {
    if (!animate && totalFrames > 1) {
      setCurrentFrame((prev) => (prev - 1 + totalFrames) % totalFrames);
    }
  }, [animate, totalFrames]);

  const handleNextFrame = useCallback(() => {
    if (!animate && totalFrames > 1) {
      setCurrentFrame((prev) => (prev + 1) % totalFrames);
    }
  }, [animate, totalFrames]);

  // Zoom handlers - memoized
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  // Mouse wheel zoom handler - memoized
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.25, Math.min(4, prev + delta)));
    }
  }, []);

  // Reset frame when thing or frame group changes
  useEffect(() => {
    setCurrentFrame(0);
  }, [thingData, frameGroupType]);

	// Reset showAllPatterns when thing changes
	useEffect(() => {
		setShowAllPatterns(false);
	}, [thingData]);

	// Reset pan when zoom changes
	useEffect(() => {
		setPanX(0);
		setPanY(0);
	}, [zoom]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only handle shortcuts when panel is focused or no input is focused
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			if (e.ctrlKey || e.metaKey) {
				switch (e.key) {
					case '=':
					case '+':
						e.preventDefault();
						handleZoomIn();
						break;
					case '-':
						e.preventDefault();
						handleZoomOut();
						break;
					case '0':
						e.preventDefault();
						handleZoomReset();
						break;
				}
			} else {
				switch (e.key) {
					case 'ArrowLeft':
						if (!animate && totalFrames > 1) {
							e.preventDefault();
							handlePreviousFrame();
						}
						break;
					case 'ArrowRight':
						if (!animate && totalFrames > 1) {
							e.preventDefault();
							handleNextFrame();
						}
						break;
					case ' ':
						if (hasAnimation) {
							e.preventDefault();
							setAnimate((prev) => !prev);
						}
						break;
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [animate, totalFrames, hasAnimation, handleZoomIn, handleZoomOut, handleZoomReset, handlePreviousFrame, handleNextFrame]);

	const handlePanChange = useCallback((x: number, y: number) => {
		setPanX(x);
		setPanY(y);
	}, []);

  return (
    <Panel
      title="Preview Panel"
      className="preview-panel"
      onClose={onClose}
      collapsible={true}
    >
        <div className="preview-container" title="PreviewPanel component">
          {thingData ? (
            <>
              <div 
                className="preview-canvas-section"
                ref={canvasSectionRef}
                onWheel={handleWheel}
                title="preview-canvas-section"
              >
								<PreviewCanvas
									thingData={thingData}
									width={200}
									height={200}
									frameGroupType={frameGroupType}
									patternX={patternX}
									patternY={patternY}
									patternZ={patternZ}
									animate={animate}
									zoom={zoom}
									currentFrame={currentFrame}
									showAllPatterns={showAllPatterns}
									backgroundColor={backgroundColor}
									showGrid={showGrid}
									onPanChange={handlePanChange}
									panX={panX}
									panY={panY}
								/>
								{/* Zoom controls */}
								<div className="preview-zoom-controls" title="preview-zoom-controls">
									<button 
										onClick={handleZoomOut}
										disabled={zoom <= 0.25}
										title="Zoom Out (Ctrl+- or Ctrl+Wheel)"
										className="preview-zoom-btn"
									>
										−
									</button>
									<span className="preview-zoom-value" title="preview-zoom-value">{Math.round(zoom * 100)}%</span>
									<button 
										onClick={handleZoomIn}
										disabled={zoom >= 4}
										title="Zoom In (Ctrl++ or Ctrl+Wheel)"
										className="preview-zoom-btn"
									>
										+
									</button>
									<button 
										onClick={handleZoomReset}
										title="Reset Zoom (Ctrl+0)"
										className="preview-zoom-btn"
									>
										⟲
									</button>
								</div>
								{zoom > 1 && (
									<div className="preview-pan-hint-container" title="preview-pan-hint-container">
										<span className="preview-pan-hint" title="preview-pan-hint">
											Drag to pan
										</span>
									</div>
								)}
              </div>
              {/* Sprite Info */}
              {frameGroup && (
                <div className="preview-info" title="preview-info">
                  <div className="preview-info-item" title="preview-info-item">
                    <span className="preview-info-label" title="preview-info-label">Sprites:</span>
                    <span className="preview-info-value" title="preview-info-value">{spriteCount}</span>
                  </div>
                  <div className="preview-info-item" title="preview-info-item">
                    <span className="preview-info-label" title="preview-info-label">Size:</span>
                    <span className="preview-info-value" title="preview-info-value">
                      {frameGroup.width || 1}×{frameGroup.height || 1}
                    </span>
                  </div>
                  {totalFrames > 1 && (
                    <div className="preview-info-item" title="preview-info-item">
                      <span className="preview-info-label" title="preview-info-label">Frames:</span>
                      <span className="preview-info-value" title="preview-info-value">
                        {currentFrame + 1} / {totalFrames}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="preview-controls" title="preview-controls">
                {availableFrameGroups.length > 1 && (
                  <div className="preview-control-group" title="preview-control-group">
                    <label title="label">Frame Group:</label>
                    <select
                      value={frameGroupType}
                      onChange={(e) => {
                        const newType = parseInt(e.target.value);
                        setFrameGroupType(newType);
                        // Reset patterns when switching frame groups
                        setPatternX(0);
                        setPatternY(0);
                        setPatternZ(0);
                      }}
                      title="select (Frame Group selector)"
                    >
                      {availableFrameGroups.map((fg) => (
                        <option key={fg.type} value={fg.type}>
                          {fg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {frameGroup && (
                  <>
                    {/* Frame Navigation */}
                    {totalFrames > 1 && !animate && (
                      <div className="preview-control-group" title="preview-control-group">
                        <label title="label">Frame:</label>
                        <div className="preview-frame-controls" title="preview-frame-controls">
													<button 
														onClick={handlePreviousFrame}
														className="preview-frame-btn"
														title="Previous Frame (←)"
													>
														◀
													</button>
													<input
														type="number"
														min="0"
														max={totalFrames - 1}
														value={currentFrame}
														onChange={(e) => {
															const frame = parseInt(e.target.value) || 0;
															setCurrentFrame(Math.max(0, Math.min(frame, totalFrames - 1)));
														}}
														className="preview-frame-input"
														title="Frame number input"
													/>
													<button 
														onClick={handleNextFrame}
														className="preview-frame-btn"
														title="Next Frame (→)"
													>
														▶
													</button>
                        </div>
                      </div>
                    )}
                    {/* Pattern Controls with Sliders */}
                    {!showAllPatterns && frameGroup.patternX > 1 && (
                      <div className="preview-control-group" title="preview-control-group">
                        <label title="label">
                          Pattern X: {patternX} / {frameGroup.patternX - 1}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={frameGroup.patternX - 1}
                          value={patternX}
                          onChange={(e) => setPatternX(parseInt(e.target.value) || 0)}
                          className="preview-pattern-slider"
                          title="preview-pattern-slider (Pattern X slider)"
                        />
                      </div>
                    )}
                    {!showAllPatterns && frameGroup.patternY > 1 && (
                      <div className="preview-control-group" title="preview-control-group">
                        <label title="label">
                          Pattern Y: {patternY} / {frameGroup.patternY - 1}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={frameGroup.patternY - 1}
                          value={patternY}
                          onChange={(e) => setPatternY(parseInt(e.target.value) || 0)}
                          className="preview-pattern-slider"
                          title="preview-pattern-slider (Pattern Y slider)"
                        />
                      </div>
                    )}
                    {frameGroup.patternZ > 1 && (
                      <div className="preview-control-group" title="preview-control-group">
                        <label title="label">
                          Pattern Z: {patternZ} / {frameGroup.patternZ - 1}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={frameGroup.patternZ - 1}
                          value={patternZ}
                          onChange={(e) => setPatternZ(parseInt(e.target.value) || 0)}
                          className="preview-pattern-slider"
                          disabled={showAllPatterns}
                          title="preview-pattern-slider (Pattern Z slider)"
                        />
                      </div>
                    )}
									{hasAnimation && (
										<div className="preview-control-group" title="preview-control-group">
											<label title="label">
												<input
													type="checkbox"
													checked={animate}
													onChange={(e) => {
														setAnimate(e.target.checked);
														if (e.target.checked) {
															setCurrentFrame(0);
														}
													}}
													title="Animate (Space)"
												/>
												{' '}Animate
											</label>
										</div>
									)}
                    {/* Show All Patterns Toggle */}
                    {frameGroup && (frameGroup.patternX > 1 || frameGroup.patternY > 1) && (
                      <div className="preview-control-group" title="preview-control-group">
                        <label title="label">
                          <input
                            type="checkbox"
                            checked={showAllPatterns}
                            onChange={(e) => {
                              setShowAllPatterns(e.target.checked);
                            }}
                            title="input[type=checkbox] (Show All Patterns checkbox)"
                          />
                          {' '}Show All Patterns
                        </label>
                      </div>
                    )}
                    {/* Background Color */}
                    <div className="preview-control-group" title="preview-control-group">
                      <label title="label">Background Color:</label>
                      <div className="preview-color-control">
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          title="input[type=color] (Background color picker)"
                        />
                        <input
                          type="text"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="preview-color-input"
                          title="input[type=text] (Background color text input)"
                        />
                      </div>
                    </div>
                    {/* Grid Overlay */}
                    <div className="preview-control-group" title="preview-control-group">
                      <label title="label">
                        <input
                          type="checkbox"
                          checked={showGrid}
                          onChange={(e) => setShowGrid(e.target.checked)}
                          title="input[type=checkbox] (Show Grid checkbox)"
                        />
                        {' '}Show Grid
                      </label>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="preview-placeholder" title="preview-placeholder">
              <p title="p">Select a thing to preview</p>
            </div>
          )}
        </div>
    </Panel>
  );
};

export const PreviewPanel = memo(PreviewPanelComponent);

