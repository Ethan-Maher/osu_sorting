import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import osuLogo from '../assets/osu.png';
import { FaArrowLeft, FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaPlus, FaFileExport, FaFileImport, FaSearch, FaTimes } from 'react-icons/fa';
import './ClothingList.css';
import { API_URLS, API_BASE_URL } from '../config';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface Item {
  id: string;
  categoryId: string;
  brand: string;
  size: string;
  price: number;
  color: string;
  sku: string;
  sold?: boolean;
}

interface Category {
  id: string;
  name: string;
}

function getColorHex(color: string): string {
  if (!color) return '#6b7280';
  // Normalize: trim, lowercase, collapse multiple spaces
  const normalized = color.trim().toLowerCase().replace(/\s+/g, ' ');
  switch (normalized) {
    case 'red': return '#bb0000';
    case 'orange': return '#f59e42';
    case 'yellow': return '#fde047';
    case 'green': return '#16a34a';
    case 'blue': return '#2563eb';
    case 'indigo': return '#6366f1';
    case 'violet': return '#a78bfa';
    case 'pink': return '#ec4899';
    case 'royal blue': return '#4169e1'; // Standard royal blue
    case 'light blue': return '#38bdf8'; // Standard light blue
    case 'lime': return '#a3e635';
    case 'peach': return '#ffbfae';
    case 'teal': return '#14b8a6';
    case 'gray': return '#6b7280';
    default: return '#6b7280';
  }
}

function getContrastColor(bgColor: string): string {
  if (!bgColor.startsWith('#') || bgColor.length !== 7) return '#fff';
  const color = bgColor.replace('#', '');
  const r = parseInt(color.substr(0,2),16);
  const g = parseInt(color.substr(2,2),16);
  const b = parseInt(color.substr(4,2),16);
  const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
  return luminance > 0.6 ? '#222' : '#fff';
}

const ClothingList: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchSku, setSearchSku] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'sku' | 'brand' | 'size' | 'price' | 'color'>('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [tab, setTab] = useState<'current' | 'sold'>('current');
  const [showImportModal, setShowImportModal] = useState(false);
  const navigate = useNavigate();

  const fetchCategory = async () => {
    try {
      const res = await fetch(`${API_URLS.categories}/${categoryId}`);
      if (!res.ok) throw new Error('Failed to fetch category');
      const data = await res.json();
      setCategory(data);
    } catch (e) {
      setError('Failed to load category');
    }
  };

  const fetchItems = async (tabOverride?: 'current' | 'sold') => {
    setLoading(true);
    try {
      let url = '';
      const tabToFetch = tabOverride || tab;
      if (tabToFetch === 'current') {
        url = `${API_URLS.items}/${categoryId}/current`;
      } else {
        url = `${API_URLS.items}/${categoryId}/sold`;
      }
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('API_URLS.items:', API_URLS.items);
      console.log('Fetching items from:', url, 'for tab:', tabToFetch);
      const res = await fetch(url);
      console.log('Response status:', res.status, res.statusText);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch items: ${res.status} ${res.statusText}`);
      }
      let data = await res.json();
      console.log('Fetched items:', data);
      data = data.map((item: Item) => ({ ...item, sold: !!item.sold }));
      setItems(data);
    } catch (e) {
      console.error('Error fetching items:', e);
      setError(`Failed to load items: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategory();
    fetchItems();
    // eslint-disable-next-line
  }, [categoryId, tab]);

  // Add or update item
  const handleSave = async (item: Item) => {
    try {
      if (editItem) {
        // Edit
        const res = await fetch(`${API_URLS.items}/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: item.brand,
            size: item.size,
            price: item.price,
            sku: item.sku,
            categoryId,
          }),
        });
        if (!res.ok) throw new Error('Failed to update item');
        // Always refetch items after update
        fetchItems();
      } else {
        // Add new
        const requestBody = {
          brand: item.brand,
          size: item.size,
          price: item.price,
          sku: item.sku,
          categoryId,
          sold: tab === 'sold' ? true : false,
        };
        console.log('Adding new item with data:', requestBody);
        const res = await fetch(API_URLS.items, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        console.log('Create item response status:', res.status, res.statusText);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Create item API Error:', errorText);
          throw new Error(`Failed to create item: ${res.status} ${res.statusText}`);
        }
        const createdItem = await res.json();
        console.log('Created item response:', createdItem);
        // Always refetch items after add
        fetchItems();
      }
      setShowModal(false);
      setEditItem(null);
    } catch (e) {
      console.error('Error in handleSave:', e);
      setError(`Failed to save item: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  // Remove item
  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URLS.items}/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== id));
      } else {
        const data = await res.json();
        setError(data.error || 'Error deleting item');
      }
    } catch {
      setError('Error deleting item');
    }
  };

  // Reorder items (move up/down)
  const moveItem = async (idx: number, dir: -1 | 1) => {
    const newItems = [...items];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    [newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]];
    // Update order in backend
    await fetch(`${API_URLS.items}/${categoryId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newItems.map(i => i.id) }),
    });
    setItems(newItems.map((i, idx) => ({ ...i, order: idx + 1 })));
  };

  const handleMoveSold = async (item: Item, sold: boolean) => {
    try {
      console.log('Moving item to sold:', { id: item.id, sku: item.sku, sold: sold });
      const res = await fetch(`${API_URLS.items}/${item.id}/sold`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: !!sold }),
      });
      if (!res.ok) throw new Error('Failed to update sold status');
      const updatedItem = await res.json();
      console.log('Updated item response:', updatedItem);
      // Always refetch items after move
      fetchItems();
    } catch (e) {
      console.error('Error moving item:', e);
      setError('Failed to move item');
    }
  };

  // Export to Excel
  const handleExport = () => {
    // Prepare data for export (filteredItems)
    const exportData = filteredItems.map((item, idx) => ({
      Position: idx + 1,
      SKU: item.sku,
      Brand: item.brand,
      Size: item.size,
      Price: item.price,
      Color: item.color,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clothing');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const fileName = `${category?.name || 'clothing'}-inventory.xlsx`;
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), fileName);
  };

  // Import from Excel/CSV
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Imported data:', jsonData);

      // Process each row and add items
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const row of jsonData) {
        try {
          // Extract data from row (handle different column names)
          const sku = (row as any).SKU || (row as any).sku || (row as any)['SKU/Tag'];
          const brand = (row as any).Brand || (row as any).brand;
          const size = (row as any).Size || (row as any).size;
          const price = (row as any).Price || (row as any).price;
          const color = (row as any).Color || (row as any).color;

          // Validate required fields
          if (!sku || !brand || !size || price === undefined || price === null) {
            errors.push(`Row missing required fields: SKU=${sku}, Brand=${brand}, Size=${size}, Price=${price}`);
            errorCount++;
            continue;
          }

          // Convert price to number
          const priceNum = typeof price === 'string' ? parseFloat(price) : price;
          if (isNaN(priceNum) || priceNum < 0) {
            errors.push(`Invalid price for SKU ${sku}: ${price}`);
            errorCount++;
            continue;
          }

          // Add item to database
          const requestBody = {
            brand: brand.toString().trim(),
            size: size.toString().trim(),
            price: priceNum,
            sku: sku.toString().trim(),
            categoryId,
            sold: tab === 'sold' ? true : false,
          };

          console.log('Adding imported item:', requestBody);
          const res = await fetch(API_URLS.items, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (!res.ok) {
            const errorText = await res.text();
            errors.push(`Failed to add SKU ${sku}: ${errorText}`);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          errors.push(`Error processing row: ${e instanceof Error ? e.message : 'Unknown error'}`);
          errorCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        alert(`Import completed!\n\nSuccessfully imported: ${successCount} items\nFailed: ${errorCount} items${errors.length > 0 ? '\n\nErrors:\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n... and ' + (errors.length - 5) + ' more errors' : '') : ''}`);
        // Refresh the items list
        fetchItems();
      } else {
        alert(`Import failed!\n\nNo items were imported.\nErrors:\n${errors.join('\n')}`);
      }

      // Clear the file input
      event.target.value = '';
    } catch (e) {
      console.error('Error importing file:', e);
      alert(`Error importing file: ${e instanceof Error ? e.message : 'Unknown error'}`);
      event.target.value = '';
    }
  };

  // Sorting logic
  const handleSort = (column: 'sku' | 'brand' | 'size' | 'price' | 'color') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (sortBy === 'price') {
      valA = Number(valA);
      valB = Number(valB);
    } else {
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredItems = sortedItems.filter(item =>
    typeof item.sku === 'string' && item.sku.toLowerCase().includes(searchSku.toLowerCase())
  );

  // Debug logging
  console.log('Filtering results:', {
    totalItems: items.length,
    filteredItems: filteredItems.length,
    searchSku,
    items: items
  });

  if (!categoryId) {
    return <div style={{ color: 'red', margin: 32 }}>Invalid category. Please go back and select a category.</div>;
  }

  return (
    <div className="clothing-list-bg">
      <div className="clothing-list-card glass">
        <button className="back-btn" onClick={() => navigate('/dashboard')}><FaArrowLeft /> Back</button>
        <img src={osuLogo} alt="Ohio State Logo" className="osu-logo" />
        <div className="clothing-list-header">
          <h2>
            {category?.name ? `${category.name} Inventory` : 'Clothing Inventory'}
          </h2>
          <div className="header-divider" />
          <div className="clothing-list-subtitle">Manage, sort, and track donated clothing for OSU.</div>
        </div>
        <div className="clothing-list-actions">
          <div className="sku-search-wrapper">
            <span className="sku-search-icon"><FaSearch /></span>
            <input
              type="text"
              className="sku-search-input"
              placeholder="Search by SKU/Tag..."
              value={searchSku}
              onChange={e => setSearchSku(e.target.value)}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="osu-btn"><FaPlus style={{marginRight: 6}} />Add Item</button>
          <button onClick={handleExport} className="osu-btn osu-btn-gray"><FaFileExport style={{marginRight: 6}} />Export</button>
          <button onClick={() => setShowImportModal(true)} className="osu-btn osu-btn-gray">
            <FaFileImport style={{marginRight: 6}} />Import
          </button>
        </div>
        <div className="tab-row">
          <button className={tab === 'current' ? 'tab-active' : ''} onClick={() => setTab('current')}>Current Inventory</button>
          <button className={tab === 'sold' ? 'tab-active' : ''} onClick={() => setTab('sold')}>Sold Inventory</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>Loading...</div>
        ) : (
          <div className="table-responsive">
            <table className="clothing-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sku')}>
                    SKU {sortBy === 'sku' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('brand')}>
                    Brand {sortBy === 'brand' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('size')}>
                    Size {sortBy === 'size' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('price')}>
                    Price {sortBy === 'price' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('color')}>
                    Color {sortBy === 'color' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>No items yet.</td></tr>
                )}
                {filteredItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td data-label="Position">{idx + 1}</td>
                    <td data-label="SKU">{item.sku}</td>
                    <td data-label="Brand">{item.brand}</td>
                    <td data-label="Size">{item.size}</td>
                    <td data-label="Price">${item.price.toFixed(2)}</td>
                    <td data-label="Color"><div
                      className="pill-badge"
                      style={{
                        backgroundColor: getColorHex(item.color),
                        color: getContrastColor(getColorHex(item.color)),
                        border: '2px solid #222',
                        cursor: 'default',
                        pointerEvents: 'none',
                        minWidth: 80,
                        fontWeight: 700,
                        display: 'inline-block',
                        textAlign: 'center'
                      }}
                      tabIndex={-1}
                      aria-label={item.color}
                    >
                      {item.color}
                      {/* TEMP DEBUG: Show normalized and hex for two-word colors */}
                      {(() => {
                        const norm = (item.color || '').trim().toLowerCase().replace(/\s+/g, ' ');
                        if (norm === 'royal blue' || norm === 'light blue') {
                          return <div style={{fontSize: '0.7em', color: '#222'}}>[{norm}] [{getColorHex(item.color)}]</div>;
                        }
                        return null;
                      })()}
                    </div></td>
                    <td data-label="Actions">
                      <button className="osu-btn osu-btn-sm osu-btn-icon" title="Edit" onClick={() => { setEditItem(item); setShowModal(true); }}><FaEdit /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Remove" onClick={() => handleRemove(item.id, item.sku)}><FaTrash /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Move Up" onClick={() => moveItem(idx, -1)} disabled={idx === 0}><FaArrowUp /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Move Down" onClick={() => moveItem(idx, 1)} disabled={idx === filteredItems.length - 1}><FaArrowDown /></button>
                      <button 
                        className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" 
                        title={tab === 'current' ? "Move to Sold" : "Move to Current"} 
                        onClick={() => handleMoveSold(item, tab === 'current' ? true : false)}
                      >
                        {tab === 'current' ? 'Move to Sold' : 'Move to Current'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showModal && (
          <ItemModal
            onClose={() => { setShowModal(false); setEditItem(null); }}
            onSave={handleSave}
            initial={editItem}
          />
        )}
        {showImportModal && (
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onImport={handleImport}
          />
        )}
      </div>
    </div>
  );
};

// Modal for add/edit item
const ItemModal: React.FC<{
  onClose: () => void;
  onSave: (item: Item) => void;
  initial?: Item | null;
}> = ({ onClose, onSave, initial }) => {
  const [brand, setBrand] = useState(initial?.brand || '');
  const [size, setSize] = useState(initial?.size || '');
  const [price, setPrice] = useState(initial?.price?.toString() || '');
  const [sku, setSku] = useState(initial?.sku || '');
  const [error, setError] = useState('');

  const color = colorChart[Math.round(parseFloat(price))] || 'gray';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!brand.trim() || !size.trim() || !price.trim() || !sku.trim()) {
      setError('All fields are required');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price must be a valid non-negative number');
      return;
    }
    onSave({
      id: initial?.id || Math.random().toString(36).substr(2, 9),
      brand,
      size,
      price: priceNum,
      color: '', // color is now handled by the backend
      sku,
      categoryId: '', // will be set in parent
    });
  };
 
  return (
    <div className="modal-bg">
      <div className="modal-card glass">
        <button className="modal-close-btn" onClick={onClose} title="Close"><FaTimes /></button>
        <h3>{initial ? 'Edit' : 'Add'} Clothing Item</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Brand</label>
            <input value={brand} onChange={e => setBrand(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Size</label>
            <input value={size} onChange={e => setSize(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Price</label>
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required />
            <div style={{ marginTop: 4, fontSize: '0.95em', color: color }}>
              Color: <span className={`pill-badge pill-${color.trim().toLowerCase().replace(/\s+/g, '-')}`}>{color}</span>
            </div>
          </div>
          <div className="form-group">
            <label>SKU/Tag</label>
            <input value={sku} onChange={e => setSku(e.target.value)} required />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="osu-btn osu-btn-gray" onClick={onClose}>Cancel</button>
            <button type="submit" className="osu-btn">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const colorChart: { [key: number]: string } = {
  9: 'red',
  4: 'orange',
  10: 'yellow',
  6: 'green',
  7: 'blue',
  5: 'indigo',
  8: 'violet',
  3: 'pink',
  11: 'royal blue',
  12: 'light blue',
  2: 'lime',
  15: 'peach',
  20: 'teal',
};

// Import Modal Component
const ImportModal: React.FC<{
  onClose: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ onClose, onImport }) => {
  return (
    <div className="modal-bg">
      <div className="modal-card glass" style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
        <button className="modal-close-btn" onClick={onClose} title="Close"><FaTimes /></button>
        <h3>Import Clothing Items</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px', color: '#2563eb' }}>📋 Required Format</h4>
          <p>Your spreadsheet must have these columns (first row should be headers):</p>
          
          <div style={{ 
            background: '#f8fafc', 
            padding: '15px', 
            borderRadius: '8px', 
            margin: '10px 0',
            border: '1px solid #e2e8f0'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Column</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Required</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>SKU</td>
                  <td style={{ padding: '8px', color: '#dc2626' }}>✓ Required</td>
                  <td style={{ padding: '8px' }}>Unique identifier for the item</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Brand</td>
                  <td style={{ padding: '8px', color: '#dc2626' }}>✓ Required</td>
                  <td style={{ padding: '8px' }}>Brand name (e.g., Nike, Adidas)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Size</td>
                  <td style={{ padding: '8px', color: '#dc2626' }}>✓ Required</td>
                  <td style={{ padding: '8px' }}>Size of the item (e.g., S, M, L, XL)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Price</td>
                  <td style={{ padding: '8px', color: '#dc2626' }}>✓ Required</td>
                  <td style={{ padding: '8px' }}>Numeric price (must be positive)</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Color</td>
                  <td style={{ padding: '8px', color: '#059669' }}>Optional</td>
                  <td style={{ padding: '8px' }}>Color name (auto-generated if not provided)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px', color: '#2563eb' }}>📄 Example Format</h4>
          <div style={{ 
            background: '#f8fafc', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}>
            <div>SKU | Brand | Size | Price | Color</div>
            <div>ABC123 | Nike | M | 15.99 | Blue</div>
            <div>DEF456 | Adidas | L | 12.50 | Red</div>
            <div>GHI789 | Under Armour | S | 8.75 | Green</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px', color: '#2563eb' }}>🎨 Color Auto-Generation</h4>
          <p>If you don't include a Color column, colors will be automatically assigned based on price:</p>
          <div style={{ 
            background: '#f8fafc', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '14px'
          }}>
            <div>$2 = Lime • $3 = Pink • $4 = Orange • $5 = Indigo</div>
            <div>$6 = Green • $7 = Blue • $8 = Violet • $9 = Red</div>
            <div>$10 = Yellow • $11 = Royal Blue • $12 = Light Blue</div>
            <div>$15 = Peach • $20 = Teal • Other = Gray</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px', color: '#dc2626' }}>⚠️ Important Notes</h4>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Supported file formats: .xlsx, .xls, .csv</li>
            <li>First row must contain column headers</li>
            <li>Prices must be numbers, not text</li>
            <li>Items will be added to the current tab (Current/Sold Inventory)</li>
            <li>Start with a small test file to verify the format</li>
          </ul>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <button type="button" className="osu-btn osu-btn-gray" onClick={onClose}>
            Cancel
          </button>
          <label className="osu-btn" style={{ cursor: 'pointer', margin: 0 }}>
            Choose File & Import
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                onImport(e);
                onClose();
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default ClothingList;