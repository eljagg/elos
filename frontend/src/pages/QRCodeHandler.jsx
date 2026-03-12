/**
 * QR Code Handler Page
 * Handles QR code scans and redirects appropriately
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, Loader2, AlertCircle } from 'lucide-react';
import { qrCodeAPI } from '../services/api';

const QRCodeHandler = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qrData, setQrData] = useState(null);

  useEffect(() => {
    if (code) {
      handleQRScan();
    }
  }, [code]);

  const handleQRScan = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await qrCodeAPI.scanQRCode(code);
      
      if (response.data?.success) {
        setQrData(response.data.data);
        
        // Auto-redirect after a short delay
        setTimeout(() => {
          const redirectUrl = response.data.data.redirect_url;
          if (redirectUrl) {
            // Check if user is logged in
            const token = localStorage.getItem('accessToken');
            
            if (response.data.data.qr_type === 'guest_order' || !token) {
              // Guest ordering - redirect to guest login or order page
              navigate(redirectUrl);
            } else {
              // Logged in user - redirect to appropriate page
              navigate(redirectUrl);
            }
          }
        }, 1500);
      } else {
        setError('Invalid or expired QR code');
      }
    } catch (err) {
      console.error('QR scan error:', err);
      setError(err.response?.data?.error?.message || 'Failed to process QR code');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Processing QR Code</h2>
          <p className="text-slate-500">Please wait...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Invalid QR Code</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2 px-4 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (qrData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            {qrData.cafeteria_name}
          </h2>
          {qrData.location_name && (
            <p className="text-lg text-blue-600 font-medium mb-2">{qrData.location_name}</p>
          )}
          <p className="text-slate-500 mb-4">
            {qrData.qr_type === 'table' && 'Table ordering'}
            {qrData.qr_type === 'menu' && 'View today\'s menu'}
            {qrData.qr_type === 'quick_order' && 'Quick order'}
            {qrData.qr_type === 'guest_order' && 'Guest ordering'}
            {qrData.qr_type === 'pickup_station' && 'Pickup station'}
          </p>
          <div className="flex items-center justify-center text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Redirecting...
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default QRCodeHandler;
