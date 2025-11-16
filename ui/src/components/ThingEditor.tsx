import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWorker } from '../contexts/WorkerContext';
import { useAppStateContext } from '../contexts/AppStateContext';
import { useToast } from '../hooks/useToast';
import { CommandFactory } from '../services/CommandFactory';
import { useThingEditor } from '../contexts/ThingEditorContext';
import { PreviewCanvas } from './PreviewCanvas';
import './ThingEditor.css';

interface ThingData {
  id: number;
  category: string;
  thing?: {
    id: number;
    category: string;
    isGround?: boolean;
    groundSpeed?: number;
    stackable?: boolean;
    pickupable?: boolean;
    hasLight?: boolean;
    lightLevel?: number;
    lightColor?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export const ThingEditor: React.FC = () => {
  const worker = useWorker();
  const { selectedThingIds, currentCategory } = useAppStateContext();
  const { showSuccess, showError } = useToast();
  const { registerSaveFunction } = useThingEditor();
  const [thingData, setThingData] = useState<ThingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [originalFormData, setOriginalFormData] = useState<any>({});
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

  // Cache to prevent duplicate requests
  const loadingThingRef = useRef<number | null>(null);
  
  // Load thing when selection changes (debounced)
  useEffect(() => {
    if (selectedThingIds.length > 0) {
      const id = selectedThingIds[0];
      // Prevent duplicate requests
      if (loadingThingRef.current === id) {
        return;
      }
      loadingThingRef.current = id;
      // Debounce to prevent rapid reloads
      const timeoutId = setTimeout(() => {
        loadThing(id);
      }, 100);
      return () => clearTimeout(timeoutId);
    } else {
      setThingData(null);
      setFormData({});
      loadingThingRef.current = null;
    }
  }, [selectedThingIds, currentCategory]);

  // Listen for SetThingDataCommand
  useEffect(() => {
    const handleCommand = (command: any) => {
      if (command.type === 'SetThingDataCommand') {
        const thingId = command.data?.thing?.id;
        const thingCategory = command.data?.thing?.category;
        
        // Only update if this matches the current selection
        if (thingId && selectedThingIds.length > 0 && selectedThingIds[0] === thingId && 
            thingCategory === currentCategory) {
          setThingData(command.data);
          if (command.data && command.data.thing) {
            const thingData = command.data.thing;
            setFormData(thingData);
            // Use structuredClone if available (faster than JSON.parse/stringify), fallback to JSON
            try {
              setOriginalFormData(typeof structuredClone !== 'undefined' ? structuredClone(thingData) : JSON.parse(JSON.stringify(thingData)));
            } catch {
              // Fallback to JSON if structuredClone fails
              setOriginalFormData(JSON.parse(JSON.stringify(thingData)));
            }
          }
          // Reset preview state when thing changes
          setPatternX(0);
          setPatternY(0);
          setPatternZ(0);
          setFrameGroupType(0);
          setCurrentFrame(0);
          setAnimate(false);
          setShowAllPatterns(false);
          setLoading(false);
          loadingThingRef.current = null; // Clear loading flag
        }
      }
    };

    worker.onCommand(handleCommand);
  }, [worker, selectedThingIds, currentCategory]);

  const loadThing = async (id: number) => {
    setLoading(true);
    try {
      const command = CommandFactory.createGetThingCommand(id, currentCategory);
      await worker.sendCommand(command);
    } catch (error) {
      console.error('Failed to load thing:', error);
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Memoize hasChanges check to avoid expensive JSON.stringify on every render
  const hasChanges = useMemo((): boolean => {
    if (!thingData || !formData || !originalFormData) return false;
    // Use shallow comparison first for common cases (much faster)
    if (formData === originalFormData) return false;
    
    // For deep comparison, only stringify once and cache if needed
    // In most cases, form data changes are shallow (single field updates)
    const formKeys = Object.keys(formData);
    const originalKeys = Object.keys(originalFormData);
    
    if (formKeys.length !== originalKeys.length) return true;
    
    // Quick shallow check - if all keys match and values are primitives/equal refs
    for (const key of formKeys) {
      if (!(key in originalFormData)) return true;
      if (formData[key] !== originalFormData[key]) {
        // Only do deep comparison if shallow check fails
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
      }
    }
    
    return false;
  }, [thingData, formData, originalFormData]);

  const handleSave = async (): Promise<boolean> => {
    if (!thingData) return false;
    
    setSaving(true);
    try {
      const command = CommandFactory.createUpdateThingCommand(
        thingData.id,
        thingData.category,
        formData
      );
      const result = await worker.sendCommand(command);
      
      if (result.success) {
        // Use structuredClone if available (faster than JSON.parse/stringify)
        try {
          setOriginalFormData(typeof structuredClone !== 'undefined' ? structuredClone(formData) : JSON.parse(JSON.stringify(formData)));
        } catch {
          setOriginalFormData(JSON.parse(JSON.stringify(formData)));
        }
        showSuccess(`Thing #${thingData.id} saved successfully`);
        return true;
      } else {
        showError(result.error || 'Failed to save thing');
        return false;
      }
    } catch (error: any) {
      console.error('Failed to save thing:', error);
      showError(error.message || 'Failed to save thing');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Register save function with context
  useEffect(() => {
    const saveFn = async () => {
      if (hasChanges) {
        return await handleSave();
      }
      return true; // No changes to save
    };
    registerSaveFunction(saveFn);
  }, [hasChanges, handleSave, registerSaveFunction]);

  // Memoize computed values for preview
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

  // Frame navigation handlers
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

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  // Mouse wheel zoom handler
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

  const handlePanChange = useCallback((x: number, y: number) => {
    setPanX(x);
    setPanY(y);
  }, []);

  // Handle sprite drop on canvas
  const handleSpriteDrop = useCallback(async (spriteId: number, spriteIndex: number) => {
    if (!thingData || !thingData.thing) {
      return;
    }

    try {
      // Get sprite pixels by requesting sprite list
      const command = CommandFactory.createGetSpriteListCommand(spriteId);
      await worker.sendCommand(command);
      
      // Wait for SetSpriteListCommand response to get sprite pixels
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.offCommand(handleSpriteCommand);
          reject(new Error('Timeout waiting for sprite data'));
        }, 5000);

        const handleSpriteCommand = (cmd: any) => {
          if (cmd.type === 'SetSpriteListCommand') {
            clearTimeout(timeout);
            worker.offCommand(handleSpriteCommand);
            
            // Find the sprite in the list
            let spriteList: any[] = [];
            if (cmd.data) {
              spriteList = cmd.data.list || cmd.data.sprites || [];
            } else if (cmd.sprites) {
              spriteList = cmd.sprites;
            }
            
            const sprite = spriteList.find((s: any) => s.id === spriteId);
            if (!sprite || !sprite.pixels) {
              reject(new Error(`Sprite #${spriteId} not found or has no pixel data`));
              return;
            }

            // Get current frame group
            const frameGroup = thingData.thing.frameGroups?.[frameGroupType];
            if (!frameGroup) {
              reject(new Error('Frame group not found'));
              return;
            }

            // Get sprites for this frame group
            let groupSprites: any[] = [];
            if (thingData.sprites) {
              if (thingData.sprites instanceof Map) {
                groupSprites = thingData.sprites.get(frameGroupType) || [];
              } else if (Array.isArray(thingData.sprites)) {
                groupSprites = thingData.sprites;
              } else if (typeof thingData.sprites === 'object') {
                groupSprites = thingData.sprites[frameGroupType] || thingData.sprites[0] || [];
              }
            }

            // Ensure sprite array is large enough
            while (groupSprites.length <= spriteIndex) {
              groupSprites.push({ id: 0, pixels: null });
            }

            // Create new sprite data with the dropped sprite's pixels
            const newSpriteData = {
              id: 0xFFFFFFFF, // uint.MAX_VALUE - indicates new/replacement sprite
              pixels: sprite.pixels,
            };

            // Update the sprite at the specified index
            groupSprites[spriteIndex] = newSpriteData;

            // Create updated sprites map
            const updatedSprites = new Map();
            if (thingData.sprites instanceof Map) {
              thingData.sprites.forEach((value, key) => {
                updatedSprites.set(key, key === frameGroupType ? groupSprites : value);
              });
            } else {
              updatedSprites.set(frameGroupType, groupSprites);
            }

            // Create updated thing data with new sprites
            // The thing object needs to be updated to reflect the new sprite indices
            // For now, we'll update the frameGroup's spriteIndex to 0xFFFFFFFF for the replaced sprite
            const updatedThing = {
              ...thingData.thing,
            };
            
            // Update the frame group's sprite index to indicate replacement
            if (updatedThing.frameGroups && updatedThing.frameGroups[frameGroupType]) {
              const fg = updatedThing.frameGroups[frameGroupType];
              if (!fg.spriteIndex) {
                fg.spriteIndex = [];
              }
              // Ensure spriteIndex array is large enough
              while (fg.spriteIndex.length <= spriteIndex) {
                fg.spriteIndex.push(0);
              }
              // Set to 0xFFFFFFFF to indicate this sprite should be replaced
              fg.spriteIndex[spriteIndex] = 0xFFFFFFFF;
            }

            // Create updated thing data structure matching ThingData format
            const updatedThingData = {
              id: thingData.id,
              category: thingData.category,
              obdVersion: thingData.obdVersion || 3,
              clientVersion: thingData.clientVersion,
              thing: updatedThing,
              sprites: updatedSprites,
            };

            // Update local state
            setThingData(updatedThingData);
            
            // Send update command - the backend expects ThingData and replaceSprites
            // The command structure should match UpdateThingCommand class
            worker.sendCommand({
              type: 'UpdateThingCommand',
              thingData: updatedThingData,
              replaceSprites: true,
            }).then(() => {
              showSuccess(`Sprite #${spriteId} replaced at index ${spriteIndex}`);
              resolve();
            }).catch((error: any) => {
              console.error('Failed to update thing:', error);
              showError(error.message || 'Failed to replace sprite');
              reject(error);
            });
          }
        };

        worker.onCommand(handleSpriteCommand);
      });
    } catch (error: any) {
      console.error('Failed to handle sprite drop:', error);
      showError(error.message || 'Failed to replace sprite');
    }
  }, [thingData, frameGroupType, worker, showSuccess, showError]);

  if (loading) {
    return (
      <div className="thing-editor" title="ThingEditor component">
        <div className="editor-content" title="editor-content">
          <p title="p">Loading...</p>
        </div>
      </div>
    );
  }

  if (!thingData) {
    return (
      <div className="thing-editor" title="ThingEditor component">
        <div className="editor-content" title="editor-content">
          <p className="placeholder-text" title="placeholder-text">Select a thing to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="thing-editor" title="ThingEditor component">
      <div className="editor-header" title="editor-header">
        <h3 title="h3">Thing #{thingData.id}</h3>
        <button 
          className="save-button" 
          onClick={() => handleSave()}
          disabled={saving || !hasChanges}
          title="save-button"
        >
          {saving ? 'Saving...' : hasChanges ? 'Save' : 'Saved'}
        </button>
      </div>
      <div className="editor-content" title="editor-content">
        {/* Appearance Section */}
        <div className="editor-section appearance-section" title="editor-section appearance-section">
          <h4 title="h4">Appearance</h4>
          {thingData ? (
            <>
              <div 
                className="appearance-canvas-section"
                onWheel={handleWheel}
                title="appearance-canvas-section"
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
                  onSpriteDrop={handleSpriteDrop}
                />
                {/* Zoom controls */}
                <div className="appearance-zoom-controls" title="appearance-zoom-controls">
                  <button 
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.25}
                    title="Zoom Out (Ctrl+- or Ctrl+Wheel)"
                    className="appearance-zoom-btn"
                  >
                    −
                  </button>
                  <span className="appearance-zoom-value" title="appearance-zoom-value">{Math.round(zoom * 100)}%</span>
                  <button 
                    onClick={handleZoomIn}
                    disabled={zoom >= 4}
                    title="Zoom In (Ctrl++ or Ctrl+Wheel)"
                    className="appearance-zoom-btn"
                  >
                    +
                  </button>
                  <button 
                    onClick={handleZoomReset}
                    title="Reset Zoom (Ctrl+0)"
                    className="appearance-zoom-btn"
                  >
                    ⟲
                  </button>
                </div>
                {zoom > 1 && (
                  <div className="appearance-pan-hint-container" title="appearance-pan-hint-container">
                    <span className="appearance-pan-hint" title="appearance-pan-hint">
                      Drag to pan
                    </span>
                  </div>
                )}
              </div>
              {frameGroup && (
                <>
                  {/* Frame Group Selector */}
                  {availableFrameGroups.length > 1 && (
                    <div className="appearance-control-group" title="appearance-control-group">
                      <label title="label">Frame Group:</label>
                      <select
                        value={frameGroupType}
                        onChange={(e) => {
                          const newType = parseInt(e.target.value);
                          setFrameGroupType(newType);
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
                  {/* Frame Navigation */}
                  {totalFrames > 1 && !animate && (
                    <div className="appearance-control-group" title="appearance-control-group">
                      <label title="label">Frame:</label>
                      <div className="appearance-frame-controls" title="appearance-frame-controls">
                        <button 
                          onClick={handlePreviousFrame}
                          className="appearance-frame-btn"
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
                          className="appearance-frame-input"
                          title="Frame number input"
                        />
                        <button 
                          onClick={handleNextFrame}
                          className="appearance-frame-btn"
                          title="Next Frame (→)"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Pattern Controls */}
                  {!showAllPatterns && frameGroup.patternX > 1 && (
                    <div className="appearance-control-group" title="appearance-control-group">
                      <label title="label">
                        Pattern X: {patternX} / {frameGroup.patternX - 1}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={frameGroup.patternX - 1}
                        value={patternX}
                        onChange={(e) => setPatternX(parseInt(e.target.value) || 0)}
                        className="appearance-pattern-slider"
                        title="appearance-pattern-slider (Pattern X slider)"
                      />
                    </div>
                  )}
                  {!showAllPatterns && frameGroup.patternY > 1 && (
                    <div className="appearance-control-group" title="appearance-control-group">
                      <label title="label">
                        Pattern Y: {patternY} / {frameGroup.patternY - 1}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={frameGroup.patternY - 1}
                        value={patternY}
                        onChange={(e) => setPatternY(parseInt(e.target.value) || 0)}
                        className="appearance-pattern-slider"
                        title="appearance-pattern-slider (Pattern Y slider)"
                      />
                    </div>
                  )}
                  {frameGroup.patternZ > 1 && (
                    <div className="appearance-control-group" title="appearance-control-group">
                      <label title="label">
                        Pattern Z: {patternZ} / {frameGroup.patternZ - 1}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={frameGroup.patternZ - 1}
                        value={patternZ}
                        onChange={(e) => setPatternZ(parseInt(e.target.value) || 0)}
                        className="appearance-pattern-slider"
                        disabled={showAllPatterns}
                        title="appearance-pattern-slider (Pattern Z slider)"
                      />
                    </div>
                  )}
                  {hasAnimation && (
                    <div className="appearance-control-group" title="appearance-control-group">
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
                  {(frameGroup.patternX > 1 || frameGroup.patternY > 1) && (
                    <div className="appearance-control-group" title="appearance-control-group">
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
                  <div className="appearance-control-group" title="appearance-control-group">
                    <label title="label">Background Color:</label>
                    <div className="appearance-color-control">
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
                        className="appearance-color-input"
                        title="input[type=text] (Background color text input)"
                      />
                    </div>
                  </div>
                  {/* Grid Overlay */}
                  <div className="appearance-control-group" title="appearance-control-group">
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
            </>
          ) : (
            <div className="appearance-placeholder" title="appearance-placeholder">
              <p title="p">Select a thing to preview</p>
            </div>
          )}
        </div>

        <div className="editor-section" title="editor-section">
          <h4 title="h4">Basic Properties</h4>
          <div className="form-group" title="form-group">
            <label title="label">ID:</label>
            <input type="number" value={thingData.id} disabled title="input[type=number] (ID)" />
          </div>
          <div className="form-group" title="form-group">
            <label title="label">Category:</label>
            <input type="text" value={thingData.category} disabled title="input[type=text] (Category)" />
          </div>
        </div>

        <div className="editor-section" title="editor-section">
          <h4 title="h4">Ground Properties</h4>
          <div className="form-group checkbox-group" title="form-group checkbox-group">
            <label title="label">
              <input
                type="checkbox"
                checked={formData.isGround || false}
                onChange={(e) => handleFieldChange('isGround', e.target.checked)}
                title="input[type=checkbox] (Is Ground)"
              />
              Is Ground
            </label>
          </div>
          {formData.isGround && (
            <div className="form-group" title="form-group">
              <label title="label">Ground Speed:</label>
              <input
                type="number"
                value={formData.groundSpeed || 0}
                onChange={(e) => handleFieldChange('groundSpeed', parseInt(e.target.value) || 0)}
                min="0"
                max="1000"
                title="input[type=number] (Ground Speed)"
              />
            </div>
          )}
        </div>

        <div className="editor-section">
          <h4>Item Properties</h4>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.stackable || false}
                onChange={(e) => handleFieldChange('stackable', e.target.checked)}
              />
              Stackable
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.pickupable || false}
                onChange={(e) => handleFieldChange('pickupable', e.target.checked)}
              />
              Pickupable
            </label>
          </div>
        </div>

        <div className="editor-section">
          <h4>Light Properties</h4>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.hasLight || false}
                onChange={(e) => handleFieldChange('hasLight', e.target.checked)}
              />
              Has Light
            </label>
          </div>
          {formData.hasLight && (
            <>
              <div className="form-group">
                <label>Light Level:</label>
                <input
                  type="number"
                  value={formData.lightLevel || 0}
                  onChange={(e) => handleFieldChange('lightLevel', parseInt(e.target.value) || 0)}
                  min="0"
                  max="255"
                />
              </div>
              <div className="form-group">
                <label>Light Color:</label>
                  <input
                    type="number"
                    value={formData.lightColor || 0}
                    onChange={(e) => handleFieldChange('lightColor', parseInt(e.target.value) || 0)}
                    min="0"
                    max="255"
                  />
              </div>
            </>
          )}
        </div>

        <div className="editor-section">
          <h4>Movement Properties</h4>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isUnpassable || false}
                onChange={(e) => handleFieldChange('isUnpassable', e.target.checked)}
              />
              Unpassable
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isUnmoveable || false}
                onChange={(e) => handleFieldChange('isUnmoveable', e.target.checked)}
              />
              Unmoveable
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.blockMissile || false}
                onChange={(e) => handleFieldChange('blockMissile', e.target.checked)}
              />
              Block Missile
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.blockPathfind || false}
                onChange={(e) => handleFieldChange('blockPathfind', e.target.checked)}
              />
              Block Pathfind
            </label>
          </div>
        </div>

        <div className="editor-section">
          <h4>Container Properties</h4>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isContainer || false}
                onChange={(e) => handleFieldChange('isContainer', e.target.checked)}
              />
              Is Container
            </label>
          </div>
        </div>

        <div className="editor-section">
          <h4>Writable Properties</h4>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.writable || false}
                onChange={(e) => handleFieldChange('writable', e.target.checked)}
              />
              Writable
            </label>
          </div>
          {formData.writable && (
            <div className="form-group">
              <label>Max Text Length:</label>
              <input
                type="number"
                value={formData.maxTextLength || 0}
                onChange={(e) => handleFieldChange('maxTextLength', parseInt(e.target.value) || 0)}
                min="0"
                max="255"
              />
            </div>
          )}
        </div>

        <div className="editor-section">
          <h4>Offset & Elevation</h4>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.hasOffset || false}
                onChange={(e) => handleFieldChange('hasOffset', e.target.checked)}
              />
              Has Offset
            </label>
          </div>
          {formData.hasOffset && (
            <>
              <div className="form-group">
                <label>Offset X:</label>
                <input
                  type="number"
                  value={formData.offsetX || 0}
                  onChange={(e) => handleFieldChange('offsetX', parseInt(e.target.value) || 0)}
                  min="-128"
                  max="127"
                />
              </div>
              <div className="form-group">
                <label>Offset Y:</label>
                <input
                  type="number"
                  value={formData.offsetY || 0}
                  onChange={(e) => handleFieldChange('offsetY', parseInt(e.target.value) || 0)}
                  min="-128"
                  max="127"
                />
              </div>
            </>
          )}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.hasElevation || false}
                onChange={(e) => handleFieldChange('hasElevation', e.target.checked)}
              />
              Has Elevation
            </label>
          </div>
          {formData.hasElevation && (
            <div className="form-group">
              <label>Elevation:</label>
              <input
                type="number"
                value={formData.elevation || 0}
                onChange={(e) => handleFieldChange('elevation', parseInt(e.target.value) || 0)}
                min="0"
                max="32"
              />
            </div>
          )}
        </div>

        <div className="editor-section">
          <h4>Minimap Properties</h4>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.miniMap || false}
                onChange={(e) => handleFieldChange('miniMap', e.target.checked)}
              />
              Show on Minimap
            </label>
          </div>
          {formData.miniMap && (
            <div className="form-group">
              <label>Minimap Color:</label>
              <input
                type="number"
                value={formData.miniMapColor || 0}
                onChange={(e) => handleFieldChange('miniMapColor', parseInt(e.target.value) || 0)}
                min="0"
                max="255"
              />
            </div>
          )}
        </div>

        {currentCategory === 'item' && (
          <div className="editor-section">
            <h4>Market Properties</h4>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isMarketItem || false}
                  onChange={(e) => handleFieldChange('isMarketItem', e.target.checked)}
                />
                Market Item
              </label>
            </div>
            {formData.isMarketItem && (
              <>
                <div className="form-group">
                  <label>Market Name:</label>
                  <input
                    type="text"
                    value={formData.marketName || ''}
                    onChange={(e) => handleFieldChange('marketName', e.target.value)}
                    placeholder="Item name"
                  />
                </div>
                <div className="form-group">
                  <label>Market Category:</label>
                  <input
                    type="number"
                    value={formData.marketCategory || 0}
                    onChange={(e) => handleFieldChange('marketCategory', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
