import { useState } from 'react';
import { Upload, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

export function CSVUploadZone({ onUpload, title, description, expectedColumns }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  const validateAndParse = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
        transform: (v) => (typeof v === 'string' ? v.trim() : v),
        complete: (results) => {
          if (results.data.length === 0) {
            reject('CSV file is empty');
            return;
          }

          const firstRow = results.data[0];
          const missingColumns = expectedColumns.filter(
            (col) => !(col.toLowerCase() in firstRow)
          );

          if (missingColumns.length > 0) {
            reject(`Missing columns: ${missingColumns.join(', ')}`);
            return;
          }

          resolve(results.data);
        },
        error: (error) => reject(error.message),
      });
    });
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setStatus('error');
      setMessage('Please upload a CSV file');
      setTimeout(() => setStatus(null), 4000);
      return;
    }

    try {
      const data = await validateAndParse(file);
      setStatus('success');
      setMessage(`Successfully loaded ${data.length} rows`);
      setTimeout(() => setStatus(null), 3000);
      onUpload(data);
    } catch (error) {
      setStatus('error');
      setMessage(error);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const handleFileInput = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await validateAndParse(file);
      setStatus('success');
      setMessage(`Successfully loaded ${data.length} rows`);
      setTimeout(() => setStatus(null), 3000);
      onUpload(data);
    } catch (error) {
      setStatus('error');
      setMessage(error);
      setTimeout(() => setStatus(null), 4000);
    }

    e.target.value = '';
  };

  return (
    <div className="w-full">
      <h3 className="font-display text-xl text-[#12142A] mb-1 tracking-tight">{title}</h3>
      <p className="text-sm text-[#58534C] font-medium mb-4">{description}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragOver
            ? 'border-[#005682] bg-[#CFE4EB]/40'
            : 'border-[#D7D1C8] bg-[#FAF8F5] hover:border-[#A8C8C2]'
        }`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center gap-3">
          <Upload
            className={`w-8 h-8 ${isDragOver ? 'text-[#005682]' : 'text-[#A29A8E]'}`}
            strokeWidth={1.8}
          />
          <div>
            <p className="font-semibold text-[#12142A]">
              Drag and drop your CSV here
            </p>
            <p className="text-sm text-[#58534C] font-medium">or click to browse</p>
          </div>
        </div>
      </div>

      {status && (
        <div
          className={`mt-3 flex gap-2 p-3 rounded-xl border ${
            status === 'success'
              ? 'bg-[#E8F0EE] text-[#335649] border-[#A8C8C2]'
              : 'bg-[#FDEBEC] text-[#9F2F2D] border-[#F2C9CC]'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
          )}
          <p className="text-sm font-medium">{message}</p>
        </div>
      )}
    </div>
  );
}
