/**
 * QR Code Management Page
 * For kitchen/admin to create and manage QR codes
 */

import { useState, useEffect } from 'react';
import { 
  QrCode, Plus, Trash2, Download, RefreshCw, 
  Copy, CheckCircle, X, Printer
} from 'lucide-react';
import { qrCodeAPI } from '../../services/api';

const QRCodeManagement = () => {
  const [qrCodes, setQRCodes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  
  // Form state
  const [form, setForm] = useState({
    cafeteriaId: '',
    qrType: 'table',
    locationName: '',
    locationDescription: ''
  });
  
  const [bulkForm, setBulkForm] = useState({
    cafeteriaId: '',
    qrType: 'table',
    prefix: 'Table',
    count: 10
  });

  const qrTypes = [
    { value: 'table', label: 'Table', description: 'For table-side ordering' },
    { value: 'menu', label: 'Menu', description: 'View today\'s menu' },
    { value: 'quick_order', label: 'Quick Order', description: 'Fast ordering for logged-in users' },
    { value: 'guest_order', label: 'Guest Order', description: 'Guest ordering without login' },
    { value: 'pickup_station', label: 'Pickup Station', description: 'Mark pickup locations' }
  ];

  useEffect(() => {
    fetchQRCodes();
    fetchStats();
  }, []);

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const response = await qrCodeAPI.getQRCodes();
      setQRCodes(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await qrCodeAPI.getQRCodeStats();
      setStats(response.data?.data || null);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await qrCodeAPI.createQRCode(form);
      if (response.data?.success) {
        setQRCodes(prev => [response.data.data, ...prev]);
        setShowCreateModal(false);
        setForm({ cafeteriaId: form.cafeteriaId, qrType: 'table', locationName: '', locationDescription: '' });
      }
    } catch (error) {
      console.error('Failed to create QR code:', error);
      alert(error.response?.data?.error?.message || 'Failed to create QR code');
    } finally {
      setCreating(false);
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await qrCodeAPI.bulkCreateQRCodes(bulkForm);
      if (response.data?.success) {
        setQRCodes(prev => [...response.data.data, ...prev]);
        setShowBulkModal(false);
        alert(`Created ${response.data.data.length} QR codes`);
      }
    } catch (error) {
      console.error('Failed to bulk create:', error);
      alert(error.response?.data?.error?.message || 'Failed to create QR codes');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this QR code? This action cannot be undone.')) return;
    
    try {
      await qrCodeAPI.deleteQRCode(id);
      setQRCodes(prev => prev.filter(qr => qr.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete QR code');
    }
  };

  const handleToggleActive = async (qrCode) => {
    try {
      await qrCodeAPI.updateQRCode(qrCode.id, { isActive: !qrCode.is_active });
      setQRCodes(prev => prev.map(qr => 
        qr.id === qrCode.id ? { ...qr, is_active: !qr.is_active } : qr
      ));
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  const copyToClipboard = (qrCode) => {
    const url = `${window.location.origin}/qr/${qrCode.code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(qrCode.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateQRImage = (code) => {
    // Using a free QR code API for display
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/qr/${code}`)}`;
  };

  const downloadQR = (qrCode) => {
    const link = document.createElement('a');
    link.href = generateQRImage(qrCode.code);
    link.download = `qr-${qrCode.location_name || qrCode.qr_type}-${qrCode.code.slice(0, 8)}.png`;
    link.click();
  };

  const printQRCodes = (codes) => {
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - Print</title>
        <style>
          body { font-family: Arial, sans-serif; }
          .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; }
          .qr-item { text-align: center; border: 1px solid #ddd; padding: 15px; }
          .qr-item img { width: 150px; height: 150px; }
          .qr-item h3 { margin: 10px 0 5px; font-size: 14px; }
          .qr-item p { margin: 0; font-size: 12px; color: #666; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding: 20px; background: #f0f0f0;">
          <button onclick="window.print()">Print</button>
          <button onclick="window.close()">Close</button>
        </div>
        <div class="qr-grid">
          ${codes.map(qr => `
            <div class="qr-item">
              <img src="${generateQRImage(qr.code)}" alt="QR Code" />
              <h3>${qr.location_name || qr.qr_type}</h3>
              <p>${qr.cafeteria_name || ''}</p>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">QR Code Management</h1>
            <p className="text-slate-500">Create and manage QR codes for table ordering</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => printQRCodes(qrCodes.filter(qr => qr.is_active))}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              <Printer className="w-4 h-4" />
              Print All
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              <Plus className="w-4 h-4" />
              Bulk Create
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create QR Code
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {stats.byType?.map((s) => (
              <div key={s.qr_type} className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-500 capitalize">{s.qr_type.replace('_', ' ')}</p>
                <p className="text-2xl font-bold text-slate-800">{s.total_codes}</p>
                <p className="text-xs text-slate-400">{s.total_scans || 0} total scans</p>
              </div>
            ))}
          </div>
        )}

        {/* QR Codes Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : qrCodes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No QR codes created yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Create your first QR code
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {qrCodes.map((qr) => (
              <div 
                key={qr.id} 
                className={`bg-white rounded-lg border overflow-hidden ${
                  qr.is_active ? 'border-slate-200' : 'border-red-200 bg-red-50'
                }`}
              >
                {/* QR Image */}
                <div className="p-4 flex justify-center bg-slate-50">
                  <img 
                    src={generateQRImage(qr.code)} 
                    alt={`QR Code for ${qr.location_name || qr.qr_type}`}
                    className={`w-32 h-32 ${!qr.is_active ? 'opacity-50' : ''}`}
                  />
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-800">
                      {qr.location_name || qr.qr_type}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      qr.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {qr.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-500 mb-1">{qr.cafeteria_name}</p>
                  <p className="text-xs text-slate-400 capitalize">{qr.qr_type.replace('_', ' ')}</p>
                  
                  {qr.scan_count > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      {qr.scan_count} scans
                    </p>
                  )}
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => copyToClipboard(qr)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Copy URL"
                    >
                      {copiedId === qr.id ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => downloadQR(qr)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(qr)}
                      className={`p-1.5 rounded ${
                        qr.is_active 
                          ? 'text-slate-400 hover:text-yellow-600 hover:bg-yellow-50' 
                          : 'text-yellow-600 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={qr.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {qr.is_active ? '○' : '●'}
                    </button>
                    <button
                      onClick={() => handleDelete(qr.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Create QR Code</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={form.qrType}
                  onChange={(e) => setForm(prev => ({ ...prev, qrType: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {qrTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  {qrTypes.find(t => t.value === form.qrType)?.description}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location Name</label>
                <input
                  type="text"
                  value={form.locationName}
                  onChange={(e) => setForm(prev => ({ ...prev, locationName: e.target.value }))}
                  placeholder="e.g., Table 5, Counter A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  value={form.locationDescription}
                  onChange={(e) => setForm(prev => ({ ...prev, locationDescription: e.target.value }))}
                  placeholder="Additional details..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Bulk Create QR Codes</h2>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleBulkCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={bulkForm.qrType}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, qrType: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  {qrTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name Prefix</label>
                <input
                  type="text"
                  value={bulkForm.prefix}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, prefix: e.target.value }))}
                  placeholder="e.g., Table"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Will create: {bulkForm.prefix} 1, {bulkForm.prefix} 2, etc.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Count</label>
                <input
                  type="number"
                  value={bulkForm.count}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : `Create ${bulkForm.count} QR Codes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeManagement;
