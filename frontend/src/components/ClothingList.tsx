import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import osuLogo from '../assets/osu.png';
import { FaArrowLeft, FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaPlus, FaFileExport, FaSearch, FaTimes } from 'react-icons/fa';
import './ClothingList.css';
import { API_URLS } from '../config';
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
}

interface Category {
  id: string;
  name: string;
}

function getColorHex(color: string): string {
  switch (color.toLowerCase()) {
    case 'red': return '#bb0000';
    case 'orange': return '#f59e42';
    case 'yellow': return '#fde047';
    case 'green': return '#16a34a';
    case 'blue': return '#2563eb';
    case 'indigo': return '#6366f1';
    case 'violet': return '#a78bfa';
    case 'pink': return '#ec4899';
    case 'royal blue': return '#4169e1';
    case 'light blue': return '#38bdf8';
    case 'lime': return '#a3e635';
    case 'peach': return '#ffbfae';
    case 'teal': return '#14b8a6';
    case 'gray': return '#6b7280';
    default: return '#6b7280';
  }
}
function getContrastColor(bgColor: string): string {
  // Simple luminance check for contrast
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

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_URLS.items}/${categoryId}`);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setItems(data);
    } catch (e) {
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategory();
    fetchItems();
  }, [categoryId]);

  // Add or update item
  const handleSave = async (item: Item) => {
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
      const updatedItem = await res.json();
      setItems(items.map(i => i.id === updatedItem.id ? updatedItem : i));
    } else {
      // Add new
      const res = await fetch(API_URLS.items, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: item.brand,
          size: item.size,
          price: item.price,
          sku: item.sku,
          categoryId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create item');
      const newItem = await res.json();
      setItems([...items, newItem]);
    }
    setShowModal(false);
    setEditItem(null);
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

  // Export to Excel (placeholder)
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

  // Filtered items by SKU
  const filteredItems = sortedItems.filter(item =>
    typeof item.sku === 'string' && item.sku.toLowerCase().includes(searchSku.toLowerCase())
  );

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
        </div>
        {loading ? (
          <div style={{ marginTop: 24 }}>Loading...</div>
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
                    <td data-label="Color"><button
                      className={`pill-badge pill-${item.color.toLowerCase().replace(/ /g, '-')}`}
                      style={{
                        border: 'none',
                        cursor: 'default',
                        pointerEvents: 'none',
                        minWidth: 80,
                        fontWeight: 700
                      }}
                      tabIndex={-1}
                      aria-label={item.color}
                    >
                      {item.color}
                    </button></td>
                    <td data-label="Actions">
                      <button className="osu-btn osu-btn-sm osu-btn-icon" title="Edit" onClick={() => { setEditItem(item); setShowModal(true); }}><FaEdit /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Remove" onClick={() => handleRemove(item.id, item.sku)}><FaTrash /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Move Up" onClick={() => moveItem(idx, -1)} disabled={idx === 0}><FaArrowUp /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Move Down" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}><FaArrowDown /></button>
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
              Color: <span className={`pill-badge pill-${color.replace(/ /g, '\\ ')}`}>{color}</span>
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

export default ClothingList;