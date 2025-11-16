import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useWorker } from '../contexts/WorkerContext';
import { useAppStateContext } from '../contexts/AppStateContext';
import { CommandFactory } from '../services/CommandFactory';
import { SpriteThumbnail } from './SpriteThumbnail';
import './SpriteList.css';

interface SpriteListItem {
  id: number;
  pixels?: Uint8Array | ArrayBuffer | Buffer | any;
}

// Sprite pixel cache to avoid re-processing same data
// Using Map with manual LRU eviction for better performance
const spritePixelCache = new Map<number, ArrayBuffer>();
const spritePixelCacheAccessOrder = new Map<number, number>(); // Track access order for LRU
let spritePixelCacheAccessCounter = 0;
const MAX_SPRITE_CACHE_SIZE = 500;

interface SpriteListProps {
	onPaginationChange?: (pagination: {
		totalCount: number;
		minId: number;
		maxId: number;
		currentMin: number;
		currentMax: number;
	} | null) => void;
	onNavigate?: (navigateFn: (targetId: number) => void) => void;
}

export const SpriteList: React.FC<SpriteListProps> = ({ onPaginationChange, onNavigate }) => {
  const worker = useWorker();
  const { selectedSpriteIds, setSelectedSpriteIds } = useAppStateContext();
  const [sprites, setSprites] = useState<SpriteListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<{
    totalCount: number;
    minId: number;
    maxId: number;
    currentMin: number;
    currentMax: number;
  } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 80; // Fixed height for each sprite item (including padding)
  const OVERSCAN = 5; // Number of items to render outside visible area
  const SCROLL_DEBOUNCE_MS = 16; // ~60fps for scroll updates

  // Listen for SetSpriteListCommand
  useEffect(() => {
    const handleCommand = (command: any) => {
      if (command.type === 'SetSpriteListCommand') {
        // Extract sprite list from command
        // Command structure: { type, data: { selectedIds, list: SpriteData[] } }
        // Or: { type, selectedIds, sprites: SpriteData[] }
        let spriteList: SpriteListItem[] = [];
        let selectedIds: number[] = [];
        
        if (command.data) {
          spriteList = command.data.list || command.data.sprites || [];
          selectedIds = command.data.selectedIds || [];
        } else if (command.sprites) {
          spriteList = command.sprites;
          selectedIds = command.selectedIds || [];
        }
        
        // Transform SpriteData objects to UI format with caching
        const transformedList = spriteList.map((sprite: any) => {
          const id = sprite.id || 0;
          
          // Check cache first (LRU)
          if (spritePixelCache.has(id)) {
            // Update access order for LRU
            spritePixelCacheAccessOrder.set(id, ++spritePixelCacheAccessCounter);
            return {
              id,
              pixels: spritePixelCache.get(id)!,
            };
          }
          
          // Extract pixels - should be ArrayBuffer after Electron IPC serialization
          let pixels: ArrayBuffer | null = null;
          if (sprite.pixels) {
            // After Electron IPC, pixels should be ArrayBuffer
            if (sprite.pixels instanceof ArrayBuffer) {
              pixels = sprite.pixels;
            } else if (sprite.pixels instanceof Uint8Array) {
              pixels = sprite.pixels.buffer.slice(sprite.pixels.byteOffset, sprite.pixels.byteOffset + sprite.pixels.byteLength);
            } else if (sprite.pixels.buffer instanceof ArrayBuffer) {
              // Typed array view
              pixels = sprite.pixels.buffer.slice(sprite.pixels.byteOffset, sprite.pixels.byteOffset + sprite.pixels.byteLength);
            } else if (typeof sprite.pixels === 'object' && sprite.pixels.byteLength !== undefined) {
              // ArrayBuffer-like object - convert to proper ArrayBuffer
              const buffer = new ArrayBuffer(sprite.pixels.byteLength);
              new Uint8Array(buffer).set(new Uint8Array(sprite.pixels));
              pixels = buffer;
            } else {
              // Fallback: try to use as-is
              pixels = sprite.pixels;
            }
            
            // Cache the pixels (use a copy to avoid memory issues)
            if (pixels && pixels instanceof ArrayBuffer) {
              const cached = pixels.slice(0);
              spritePixelCache.set(id, cached);
              spritePixelCacheAccessOrder.set(id, ++spritePixelCacheAccessCounter);
              
              // LRU eviction: remove least recently used entry
              if (spritePixelCache.size > MAX_SPRITE_CACHE_SIZE) {
                // Find least recently used (lowest access counter)
                let lruKey: number | null = null;
                let lruAccess = Infinity;
                for (const [key, access] of spritePixelCacheAccessOrder.entries()) {
                  if (access < lruAccess) {
                    lruAccess = access;
                    lruKey = key;
                  }
                }
                if (lruKey !== null) {
                  spritePixelCache.delete(lruKey);
                  spritePixelCacheAccessOrder.delete(lruKey);
                }
              }
            }
          }
          
          return {
            id,
            pixels: pixels || undefined,
          };
        });
        
        setSprites(transformedList);
        if (selectedIds.length > 0) {
          setSelectedSpriteIds(selectedIds);
        }
        
        // Update pagination info if available
        // Check both direct properties and data wrapper
        const paginationData = command.data || command;
        if (paginationData.totalCount !== undefined || paginationData.minId !== undefined) {
          const newPagination = {
            totalCount: paginationData.totalCount || 0,
            minId: paginationData.minId || 0,
            maxId: paginationData.maxId || 0,
            currentMin: paginationData.currentMin || 0,
            currentMax: paginationData.currentMax || 0,
          };
          setPagination(newPagination);
          onPaginationChange?.(newPagination);
        } else {
          // Clear pagination if not available
          setPagination(null);
          onPaginationChange?.(null);
        }
        
        setLoading(false);
        loadingSpriteRef.current = null; // Clear loading flag
      }
    };

    worker.onCommand(handleCommand);
  }, [worker, setSelectedSpriteIds, onPaginationChange]);

  // Track last loaded thing to prevent duplicate reloads
  const lastThingRef = useRef<{ id: number; category: string } | null>(null);
  
  // Cache to prevent duplicate requests
  const loadingSpriteRef = useRef<number | null>(null);
  
  // Define loadSpriteList before it's used in reloadSpritesFromThingData
  const loadSpriteList = useCallback(async (targetId: number) => {
    // Prevent duplicate requests for the same sprite
    if (loadingSpriteRef.current === targetId) {
      return;
    }
    
    loadingSpriteRef.current = targetId;
    setLoading(true);
    try {
      const command = CommandFactory.createGetSpriteListCommand(targetId);
      await worker.sendCommand(command);
    } catch (error) {
      console.error('Failed to load sprite list:', error);
      setLoading(false);
      loadingSpriteRef.current = null;
    }
  }, [worker]);

  // Expose navigation function for external pagination component
  useEffect(() => {
    if (onNavigate) {
      onNavigate(loadSpriteList);
    }
  }, [onNavigate, loadSpriteList]);
  
  // Function to reload sprites from thing data
  const reloadSpritesFromThingData = useCallback((thingData: any) => {
    if (!thingData || !thingData.thing) {
      return;
    }
    
    const thingId = thingData.thing.id;
    const thingCategory = thingData.thing.category;
    
    // Prevent reloading if it's the same thing and category
    if (lastThingRef.current && 
        lastThingRef.current.id === thingId && 
        lastThingRef.current.category === thingCategory) {
      return;
    }
    lastThingRef.current = { id: thingId, category: thingCategory };
    
    if (thingData.sprites) {
      // Get sprites from the DEFAULT frame group (or first available)
      let spriteIds: number[] = [];
      
      // Try to get sprites from frame groups - optimized: combine map+filter into single loop
      let spritesToProcess: any[] = [];
      if (thingData.sprites instanceof Map) {
        // If it's a Map, get sprites from DEFAULT frame group (0)
        spritesToProcess = thingData.sprites.get(0) || [];
      } else if (Array.isArray(thingData.sprites)) {
        // If it's an array, use it directly
        spritesToProcess = thingData.sprites;
      } else if (thingData.sprites[0]) {
        // If it's an object with numeric keys
        spritesToProcess = thingData.sprites[0] || [];
      }
      
      // Single pass: extract IDs and filter in one loop (faster than map+filter)
      spriteIds = [];
      for (let i = 0; i < spritesToProcess.length; i++) {
        const id = spritesToProcess[i]?.id;
        if (id && id > 0) {
          spriteIds.push(id);
        }
      }
      
      // Load sprite list with first sprite ID if available
      if (spriteIds.length > 0) {
        const firstSpriteId = spriteIds[0];
        loadSpriteList(firstSpriteId);
        // Select the first sprite in the list
        setSelectedSpriteIds([firstSpriteId]);
      } else {
        setSprites([]);
        setSelectedSpriteIds([]);
        setLoading(false);
      }
    } else {
      setSprites([]);
      setLoading(false);
    }
  }, [loadSpriteList, setSelectedSpriteIds]);
  
  // Flag to indicate that the next SetThingDataCommand should trigger sprite reload
  const shouldReloadSpritesRef = useRef<number | null>(null);
  
  // Listen for explicit reload requests (from Edit or double-click)
  useEffect(() => {
    const handleReloadRequest = (event: CustomEvent) => {
      const thingId = event.detail?.thingId;
      if (thingId) {
        // Set flag so next SetThingDataCommand for this thing will trigger reload
        shouldReloadSpritesRef.current = thingId;
      }
    };

    window.addEventListener('reload-sprites-request', handleReloadRequest as EventListener);
    return () => {
      window.removeEventListener('reload-sprites-request', handleReloadRequest as EventListener);
    };
  }, []);
  
  // Listen for SetThingDataCommand and reload sprites only if flag is set
  useEffect(() => {
    const handleCommand = (command: any) => {
      if (command.type === 'SetThingDataCommand') {
        const thingData = command.data;
        if (thingData && thingData.thing) {
          const thingId = thingData.thing.id;
          
          // Only reload sprites if this was explicitly requested (Edit or double-click)
          if (shouldReloadSpritesRef.current === thingId) {
            shouldReloadSpritesRef.current = null; // Clear flag
            reloadSpritesFromThingData(thingData);
          }
        }
      }
    };

    worker.onCommand(handleCommand);
  }, [worker, reloadSpritesFromThingData]);

  const handleSpriteClick = useCallback((id: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select: toggle this sprite
      setSelectedSpriteIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(sid => sid !== id);
        } else {
          return [...prev, id];
        }
      });
    } else if (e.shiftKey && selectedSpriteIds.length > 0) {
      // Range select: select from last selected to this one
      const currentIndex = sprites.findIndex(s => s.id === id);
      const lastSelectedIndex = sprites.findIndex(s => s.id === selectedSpriteIds[selectedSpriteIds.length - 1]);
      if (currentIndex >= 0 && lastSelectedIndex >= 0) {
        const start = Math.min(currentIndex, lastSelectedIndex);
        const end = Math.max(currentIndex, lastSelectedIndex);
        const rangeIds = sprites.slice(start, end + 1).map(s => s.id);
        setSelectedSpriteIds(prev => {
          const newIds = [...prev];
          rangeIds.forEach(rid => {
            if (!newIds.includes(rid)) {
              newIds.push(rid);
            }
          });
          return newIds;
        });
      }
    } else {
      // Single select
      setSelectedSpriteIds([id]);
    }
  }, [selectedSpriteIds, sprites, setSelectedSpriteIds]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spriteId: number } | null>(null);

  // Memoize selected IDs as Set for O(1) lookups instead of O(n) includes()
  const selectedSpriteIdsSet = useMemo(() => new Set(selectedSpriteIds), [selectedSpriteIds]);

  const handleContextMenu = (e: React.MouseEvent, spriteId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, spriteId });
  };

  const handleContextMenuAction = async (action: string) => {
    if (!contextMenu) return;
    
    const spriteId = contextMenu.spriteId;
    const idsToUse = selectedSpriteIdsSet.has(spriteId) ? selectedSpriteIds : [spriteId];
    
    switch (action) {
      case 'export':
        // Trigger export dialog - this would need to be handled by parent
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('export-sprites', { detail: { ids: idsToUse } }));
        }
        break;
      case 'replace':
        // Trigger replace dialog
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('replace-sprites', { detail: { ids: idsToUse } }));
        }
        break;
      case 'delete':
        if (confirm(`Delete ${idsToUse.length} sprite(s)?`)) {
          // This would need a RemoveSpritesCommand
          console.log('Delete sprites:', idsToUse);
        }
        break;
    }
    
    setContextMenu(null);
  };

  // Virtual scrolling calculation
  const virtualScrollData = useMemo(() => {
    if (sprites.length === 0) {
      return { visibleItems: [], startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 };
    }

    const totalHeight = sprites.length * ITEM_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(
      sprites.length - 1,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
    );
    const visibleItems = sprites.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * ITEM_HEIGHT;

    return {
      visibleItems,
      startIndex,
      endIndex,
      offsetY,
      totalHeight,
    };
  }, [sprites, scrollTop, containerHeight]);

  // Debounced scroll handler for better performance
  const scrollTimeoutRef = useRef<number | null>(null);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    
    // Cancel previous timeout
    if (scrollTimeoutRef.current !== null) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }
    
    // Use requestAnimationFrame for smooth updates
    scrollTimeoutRef.current = requestAnimationFrame(() => {
      setScrollTop(target.scrollTop);
      scrollTimeoutRef.current = null;
    });
  }, []);

  // Measure container height with debouncing
  useEffect(() => {
    let rafId: number | null = null;
    const updateHeight = () => {
      if (itemsContainerRef.current) {
        setContainerHeight(itemsContainerRef.current.clientHeight);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateHeight);
    });
    if (itemsContainerRef.current) {
      resizeObserver.observe(itemsContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Keyboard navigation (only when list container is focused)
  const listRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if list is focused or contains focused element
      if (!listElement.contains(document.activeElement)) return;
      if (sprites.length === 0) return;
      
      // Use Set for O(1) lookup instead of O(n) includes()
      const selectedSet = new Set(selectedSpriteIds);
      const selectedIndex = sprites.findIndex(s => selectedSet.has(s.id));
      if (selectedIndex < 0 && sprites.length > 0) {
        // No selection, select first item
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          handleSpriteClick(sprites[0].id);
        }
        return;
      }

      let newIndex = selectedIndex;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
          newIndex = Math.min(selectedIndex + 1, sprites.length - 1);
        } else {
          newIndex = Math.max(selectedIndex - 1, 0);
        }
        
        if (newIndex >= 0 && newIndex < sprites.length) {
          const sprite = sprites[newIndex];
          handleSpriteClick(sprite.id);
          // Scroll into view
          setTimeout(() => {
            const element = document.querySelector(`[data-sprite-id="${sprite.id}"]`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 0);
        }
      }
    };

    listElement.addEventListener('keydown', handleKeyDown);
    return () => listElement.removeEventListener('keydown', handleKeyDown);
  }, [sprites, selectedSpriteIds]);

  if (loading) {
    return (
      <div className="sprite-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading sprites...</p>
      </div>
    );
  }

  return (
    <div className="sprite-list" ref={listRef} tabIndex={0}>
      {sprites.length === 0 ? (
        <div className="sprite-list-empty">
          <p>No sprites found</p>
          <p className="sprite-list-empty-hint">
            Select a thing to view its sprites
          </p>
        </div>
      ) : (
        <>
          <div className="sprite-list-header">
            <span className="sprite-list-count">
              {pagination ? (
                <>
                  {pagination.currentMin}-{pagination.currentMax} of {pagination.totalCount} sprites
                </>
              ) : (
                <>
                  {sprites.length} sprite{sprites.length !== 1 ? 's' : ''}
                </>
              )}
            </span>
          </div>
          <div 
            className="sprite-list-items"
            ref={itemsContainerRef}
            onScroll={handleScroll}
            style={{ 
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              position: 'relative'
            }}
          >
            {/* Virtual scrolling container */}
            <div 
              style={{ 
                height: virtualScrollData.totalHeight,
                position: 'relative'
              }}
            >
              {/* Offset spacer */}
              {virtualScrollData.offsetY > 0 && (
                <div style={{ height: virtualScrollData.offsetY }} />
              )}
              
              {/* Visible items */}
              {virtualScrollData.visibleItems.map((sprite, index) => {
                const actualIndex = virtualScrollData.startIndex + index;
                return (
                  <div
                    key={sprite.id}
                    data-sprite-id={sprite.id}
                    className={`sprite-list-item ${
                      selectedSpriteIdsSet.has(sprite.id) ? 'selected' : ''
                    }`}
                    onClick={(e) => handleSpriteClick(sprite.id, e)}
                    onContextMenu={(e) => handleContextMenu(e, sprite.id)}
                    draggable={true}
                    onDragStart={(e) => {
                      // Store sprite data in drag event
                      const dragData = {
                        spriteId: sprite.id,
                        pixels: sprite.pixels,
                      };
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                      // Also set a text fallback for compatibility
                      e.dataTransfer.setData('text/plain', `sprite:${sprite.id}`);
                      // Create a drag image - cache rect to avoid multiple calls
                      const rect = e.currentTarget.getBoundingClientRect();
                      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
                      dragImage.style.opacity = '0.5';
                      document.body.appendChild(dragImage);
                      dragImage.style.position = 'absolute';
                      dragImage.style.top = '-1000px';
                      e.dataTransfer.setDragImage(dragImage, e.clientX - rect.left, e.clientY - rect.top);
                      setTimeout(() => document.body.removeChild(dragImage), 0);
                    }}
                    title={`Sprite #${sprite.id}${selectedSpriteIds.length > 1 ? ` (${selectedSpriteIds.length} selected)` : ''} - Drag to preview canvas to replace sprite`}
                    style={{
                      position: 'absolute',
                      top: actualIndex * ITEM_HEIGHT,
                      left: 0,
                      right: 0,
                      height: ITEM_HEIGHT,
                    }}
                  >
                    <div className="sprite-list-item-preview">
                      {sprite.pixels ? (
                        <SpriteThumbnail 
                          pixels={sprite.pixels} 
                          size={32} 
                          scale={2}
                          format="argb" // Sprite pixels from Sprite.getPixels() are in ARGB format
                        />
                      ) : (
                        <div className="sprite-list-item-placeholder">#{sprite.id}</div>
                      )}
                    </div>
                    <div className="sprite-list-item-id">#{sprite.id}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <div className="context-menu-item" onClick={() => handleContextMenuAction('export')}>
            Export Sprite{selectedSpriteIds.length > 1 ? 's' : ''}
          </div>
          <div className="context-menu-item" onClick={() => handleContextMenuAction('replace')}>
            Replace Sprite{selectedSpriteIds.length > 1 ? 's' : ''}
          </div>
          <div className="context-menu-separator"></div>
          <div className="context-menu-item" onClick={() => handleContextMenuAction('delete')}>
            Delete Sprite{selectedSpriteIds.length > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

