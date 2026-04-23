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
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition ${
          isDragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
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
            className={`w-8 h-8 ${
              isDragOver ? 'text-primary-600' : 'text-gray-400'
            }`}
          />
          <div>
            <p className="font-medium text-gray-900">
              Drag and drop your CSV here
            </p>
            <p className="text-sm text-gray-600">or click to browse</p>
          </div>
        </div>
      </div>

      {status && (
        <div
          className={`mt-3 flex gap-2 p-3 rounded-lg ${
            status === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm">{message}</p>
        </div>
      )}
    </div>
  );
}
