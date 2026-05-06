'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import axios from '@/lib/api';
import { ArrowLeft, UploadCloud, Info } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function UploadPage() {
  const { user, updateUser, loading } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (selected.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser({ bodyCharacteristics: res.data.bodyCharacteristics });
      
      // Let user see the result for a moment before redirecting
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze image');
      setAnalyzing(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors mb-8">
        <ArrowLeft size={20} /> Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-4">Style Analysis</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Upload a full-body photo of yourself. Our AI will analyze your body type and skin tone to recommend the perfect color palettes and outfits.
          </p>

          <div 
            className={`border-2 border-dashed rounded-3xl p-10 text-center transition-colors cursor-pointer ${
              file ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10' : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg,image/png,image/webp" 
              onChange={handleFileChange}
            />
            
            {preview ? (
              <div className="flex justify-center">
                <Image src={preview} alt="Preview" width={200} height={300} className="rounded-xl object-cover h-[300px] w-auto max-w-full shadow-lg" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400 rounded-full flex items-center justify-center">
                  <UploadCloud size={32} />
                </div>
                <div>
                  <p className="font-semibold text-lg">Click to upload a photo</p>
                  <p className="text-sm text-gray-500 mt-1">JPEG, PNG or WEBP (Max 5MB)</p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 mt-4 text-center font-medium bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">{error}</p>}
          
          {file && !analyzing && (
            <button 
              onClick={handleUpload}
              className="w-full mt-6 py-4 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-lg hover:opacity-90 transition-opacity"
            >
              Analyze My Style
            </button>
          )}

          {analyzing && (
            <div className="mt-6 flex flex-col items-center p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-900/50">
              <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-4"></div>
              <p className="font-semibold text-purple-700 dark:text-purple-300">AI is analyzing your photo...</p>
              <p className="text-sm text-purple-600/70 dark:text-purple-400/70 mt-1">Identifying body type and color preferences</p>
            </div>
          )}
        </div>

        <div className="md:w-80">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 sticky top-24">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <Info size={20} className="text-blue-500" /> Current Profile
            </h3>
            
            {user.bodyCharacteristics?.bodyType ? (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Body Type</p>
                  <p className="font-medium">{user.bodyCharacteristics.bodyType}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Skin Tone</p>
                  <p className="font-medium">{user.bodyCharacteristics.skinTone}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Color Palette</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {user.bodyCharacteristics.colorPreferences?.map(c => (
                      <span key={c} className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full border shadow-sm">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No analysis performed yet. Upload a photo to generate your profile.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
