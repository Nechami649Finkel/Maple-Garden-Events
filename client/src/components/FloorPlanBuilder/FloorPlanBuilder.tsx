import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import floorPlanImg from '../../assets/floor-plan.png';
import {
  DEFAULT_TABLE_LAYOUT,
  DEFAULT_TABLE_SIZE,
  SECTION_BOUNDS,
  SEATS_PER_TABLE,
  buildLayoutForGuestCount,
  clampToSection,
  createTableInSection,
  getNextTableId,
} from '../../constants/defaultTableLayout';
import type { TableData, TableSection } from '../../constants/defaultTableLayout';
import { exportFloorPlanAsImage, renderFloorPlanToDataUrl } from '../../utils/exportFloorPlan';
import { getAuthUser } from '../../services/api';
import {
  clearFloorPlanDraft,
  loadFloorPlanDraft,
  saveFloorPlanDraft,
} from '../../utils/floorPlanDraft';
import './FloorPlanBuilder.css';

export type { TableData };

function clampPct(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface LayoutConfig {
  guestCount: number;
  seatingType?: string;
  menPercent?: number;
  womenPercent?: number;
  includeHonorTables?: boolean;
}

function resolveInitialTables(
  initialTables: TableData[] | undefined,
  layoutConfig: LayoutConfig,
): TableData[] {
  if (initialTables && initialTables.length > 0) {
    return initialTables.map(clampToSection);
  }
  if (layoutConfig.guestCount > 0) {
    return buildLayoutForGuestCount({
      guestCount: layoutConfig.guestCount,
      seatingType: layoutConfig.seatingType,
      menPercent: layoutConfig.menPercent,
      womenPercent: layoutConfig.womenPercent,
      includeHonorTables: layoutConfig.includeHonorTables,
    });
  }
  return DEFAULT_TABLE_LAYOUT.map(t => ({ ...t }));
}

interface TableItemProps {
  table: TableData;
  isSelected: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: number) => void;
  onMove: (id: number, x: number, y: number) => void;
}

const TableItem: React.FC<TableItemProps> = ({
  table,
  isSelected,
  containerRef,
  onSelect,
  onMove,
}) => {
  const tableW = DEFAULT_TABLE_SIZE;
  const tableH = DEFAULT_TABLE_SIZE;
  const bounds = SECTION_BOUNDS[table.section];

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(table.id);

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    setDragOffset({ x: 0, y: 0 });
    el.classList.add('table-dragging');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.preventDefault();
    setDragOffset({
      x: e.clientX - dragRef.current.startX,
      y: e.clientY - dragRef.current.startY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !dragOffset) return;

    const el = e.currentTarget;
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    el.classList.remove('table-dragging');

    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const dxPct = (dragOffset.x / rect.width) * 100;
      const dyPct = (dragOffset.y / rect.height) * 100;
      const newX = clampPct(table.x + dxPct, bounds.minX, bounds.maxX - tableW);
      const newY = clampPct(table.y + dyPct, bounds.minY, bounds.maxY - tableH);
      onMove(table.id, newX, newY);
    }

    dragRef.current = null;
    setDragOffset(null);
  };

  const sectionClass = table.section === 'women' ? 'table-women' : 'table-men';
  const honorClass = table.isHonor ? 'table-honor' : '';

  return (
    <div
      className={`table-box ${sectionClass} ${honorClass} ${isSelected ? 'table-selected' : ''}`}
      style={{
        left: `${table.x}%`,
        top: `${table.y}%`,
        width: `${tableW}%`,
        height: `${tableH}%`,
        transform: dragOffset ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {table.isHonor ? 'R' : table.id}
    </div>
  );
};

interface Props {
  initialTables?: TableData[];
  guestCount?: number;
  seatingType?: string;
  menPercent?: number;
  womenPercent?: number;
  includeHonorTables?: boolean;
  onSave: (tables: TableData[], imageDataUrl: string) => void;
  onClose?: () => void;
  downloadFileName?: string;
  draftEventId?: string;
}

export const FloorPlanBuilder: React.FC<Props> = ({
  initialTables,
  guestCount = 0,
  seatingType = 'separate',
  menPercent,
  womenPercent,
  includeHonorTables = true,
  onSave,
  onClose,
  downloadFileName,
  draftEventId,
}) => {
  const layoutConfig = useMemo<LayoutConfig>(() => ({
    guestCount,
    seatingType,
    menPercent,
    womenPercent,
    includeHonorTables,
  }), [guestCount, seatingType, menPercent, womenPercent, includeHonorTables]);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [tables, setTables] = useState<TableData[]>(() => resolveInitialTables(initialTables, layoutConfig));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAuthUser().then((user) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

  useEffect(() => {
    if (!draftEventId || !userEmail || draftLoaded) return;
    const draft = loadFloorPlanDraft(draftEventId, userEmail);
    if (draft && draft.length > 0) {
      setTables(draft.map(clampToSection));
      setLayoutKey((k) => k + 1);
    }
    setDraftLoaded(true);
  }, [draftEventId, userEmail, draftLoaded]);

  useEffect(() => {
    if (!draftEventId || !userEmail || !draftLoaded) return;
    const timer = setTimeout(() => {
      saveFloorPlanDraft(draftEventId, userEmail, tables);
    }, 500);
    return () => clearTimeout(timer);
  }, [draftEventId, userEmail, draftLoaded, tables]);

  const handleMove = useCallback((id: number, x: number, y: number) => {
    setTables(prev =>
      prev.map(t => (t.id === id ? clampToSection({ ...t, x, y }) : t))
    );
  }, []);

  const handleAddTable = (section: TableSection) => {
    const newId = getNextTableId(tables);
    const newTable = createTableInSection(section, newId);
    setTables(prev => [...prev, newTable]);
    setSelectedId(newId);
    setLayoutKey(k => k + 1);
  };

  const handleDeleteSelected = () => {
    if (selectedId === null) return;
    const table = tables.find(t => t.id === selectedId);
    if (!table) return;
    if (table.isHonor && DEFAULT_TABLE_LAYOUT.some(d => d.id === table.id && d.isHonor)) {
      alert('לא ניתן למחוק שולחן כבוד מברירת המחדל');
      return;
    }
    setTables(prev => prev.filter(t => t.id !== selectedId));
    setSelectedId(null);
    setLayoutKey(k => k + 1);
  };

  const handleRebuildFromGuests = () => {
    if (guestCount <= 0) {
      alert('יש להזין כמות מוזמנים סופית בטופס');
      return;
    }
    const tableCount = Math.ceil(guestCount / SEATS_PER_TABLE);
    if (!confirm(`ליצור סידור מחדש ל-${guestCount} מוזמנים (${tableCount} שולחנות)?`)) {
      return;
    }
    setTables(buildLayoutForGuestCount({
      guestCount,
      seatingType,
      menPercent,
      womenPercent,
      includeHonorTables,
    }));
    setSelectedId(null);
    setLayoutKey(k => k + 1);
  };

  const handleReset = () => {
    if (confirm('לאפס לסידור ברירת המחדל?')) {
      setTables(DEFAULT_TABLE_LAYOUT.map(t => ({ ...t })));
      setSelectedId(null);
      setLayoutKey(k => k + 1);
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      await exportFloorPlanAsImage(
        tables,
        floorPlanImg,
        downloadFileName ?? 'sidur-shulchanot.png'
      );
    } catch {
      alert('שגיאה ביצירת התמונה');
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const imageDataUrl = await renderFloorPlanToDataUrl(tables, floorPlanImg);
      if (draftEventId) clearFloorPlanDraft(draftEventId);
      onSave(tables, imageDataUrl);
    } catch {
      alert('שגיאה בשמירת הסקיצה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="floor-plan-container">
      <div className="floor-plan-toolbar">
        <div className="toolbar-actions">
          {guestCount > 0 && (
            <button type="button" className="btn-rebuild" onClick={handleRebuildFromGuests}>
              רענן לפי מוזמנים
            </button>
          )}
          <button type="button" className="btn-add-women" onClick={() => handleAddTable('women')}>
            + שולחן נשים
          </button>
          <button type="button" className="btn-add-men" onClick={() => handleAddTable('men')}>
            + שולחן גברים
          </button>
          <button
            type="button"
            className="btn-delete"
            onClick={handleDeleteSelected}
            disabled={selectedId === null}
          >
            מחק שולחן נבחר
          </button>
          <button type="button" className="btn-reset" onClick={handleReset}>
            איפוס לברירת מחדל
          </button>
          <button
            type="button"
            className="btn-download"
            onClick={handleDownload}
            disabled={exporting}
          >
            {exporting ? 'מוריד...' : '⬇ הורדת תמונה'}
          </button>
        </div>
        <div className="toolbar-save">
          <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'שומר...' : 'שמור סידור'}
          </button>
          {onClose && (
            <button type="button" className="btn-close" onClick={onClose}>
              סגור
            </button>
          )}
        </div>
      </div>

      <div className="floor-plan-viewport">
        <div className="hall-canvas" ref={canvasRef}>
          <img
            src={floorPlanImg}
            alt="מפת אולם"
            className="hall-background"
            draggable={false}
          />
          <div className="tables-layer" key={layoutKey}>
            {tables.map(table => (
              <TableItem
                key={table.id}
                table={table}
                containerRef={canvasRef}
                isSelected={selectedId === table.id}
                onSelect={setSelectedId}
                onMove={handleMove}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="floor-plan-legend">
        <span className="legend-item"><span className="legend-dot women" /> נשים</span>
        <span className="legend-item"><span className="legend-dot men" /> גברים</span>
        <span className="legend-item"><span className="legend-dot honor" /> שולחן כבוד (R)</span>
        <span className="legend-hint">גררי שולחן עם העכבר / האצבע · לחיצה לבחירה</span>
      </div>
    </div>
  );
};

export default FloorPlanBuilder;
