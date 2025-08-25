"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface FileUploadModalProps {
  sessionToken: string;
  onClose: () => void;
  onUploadSuccess: (fileName: string) => void;
}

export function FileUploadModal({ sessionToken, onClose, onUploadSuccess }: FileUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.sql')) {
      setError('Please select a SQL file (.sql extension)');
      return;
    }
    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('sessionToken', sessionToken);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      onUploadSuccess(result.fileName);
    } catch (err) {
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-black border border-neutral-700 rounded-lg p-8 max-w-md w-full font-mono"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Upload SQL File</h2>
            <p className="text-neutral-400 text-sm">
              Upload your SQL database file to start interacting with it using natural language.
              Only .sql files are supported.
            </p>
          </div>

          {/* Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 mb-4 transition-all duration-300 ${
              isDragOver
                ? 'border-cyan-400 bg-cyan-400/10'
                : selectedFile
                ? 'border-green-400 bg-green-400/10'
                : 'border-neutral-600 hover:border-neutral-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center">
              {/* Drop Icon */}
              <div className="mb-4">
                {selectedFile ? (
                  <svg className="w-12 h-12 text-green-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-12 h-12 text-neutral-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-green-400 font-medium mb-1">{selectedFile.name}</p>
                  <p className="text-neutral-400 text-sm">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-white mb-2">Drop your SQL file here</p>
                  <p className="text-neutral-400 text-sm">or</p>
                </div>
              )}
            </div>

            {/* Select Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-4 right-4 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors duration-200"
            >
              Select
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".sql"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-600 text-neutral-400 rounded-lg hover:bg-neutral-800 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedFile || isUploading}
              className="flex-1 px-4 py-2 bg-white text-black rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-200 transition-colors duration-200"
            >
              {isUploading ? 'Uploading...' : 'Submit'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}