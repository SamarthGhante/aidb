"use client";
import { useParams } from "next/navigation";
import { BackgroundLines } from "@/components/ui/background-lines";
import { FileUploadModal } from "@/components/ui/file-upload-modal";
import { ChatInterface } from "@/components/ui/chat-interface";
import { useState } from "react";

export default function DashboardPage() {
  const params = useParams();
  const sessionToken = params.sessionToken as string;
  const [showUploadModal, setShowUploadModal] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  return (
    <BackgroundLines className="min-h-screen bg-black font-mono" svgOptions={{ duration: 8 }}>
      <div className="relative z-10 min-h-screen p-8">
        {/* Dashboard Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white font-mono">AIDB Dashboard</h1>
            <p className="text-neutral-400 font-mono mt-2">Session: {sessionToken}</p>
          </div>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-2 rounded-full border border-white bg-white text-black font-mono font-medium hover:shadow-lg hover:shadow-white/30 hover:-translate-y-1 transition-all duration-300"
          >
            Upload New File
          </button>
        </div>

        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-200px)]">
          <div className="lg:col-span-2 flex flex-col min-h-0 max-h-full">
            {uploadedFile ? (
              <div className="flex-1 min-h-0 max-h-full overflow-hidden">
                <ChatInterface sessionToken={sessionToken} fileName={uploadedFile} />
              </div>
            ) : (
              <div className="bg-black/50 border border-neutral-700 rounded-lg p-6 flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white font-mono mb-4">Database Chat</h2>
                  <p className="text-neutral-400 font-mono mb-6">Upload a SQL file to start chatting with your database.</p>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="px-6 py-3 bg-white text-black rounded-lg font-mono font-medium hover:bg-neutral-200 transition-colors duration-200"
                  >
                    Upload SQL File
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div className="bg-black/50 border border-neutral-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white font-mono mb-4">Session Info</h3>
              <div className="space-y-2 text-sm font-mono">
                <p className="text-neutral-400">Status: <span className="text-green-400">Active</span></p>
                <p className="text-neutral-400">Files: <span className="text-white">{fileCount}</span></p>
                <p className="text-neutral-400">Database: <span className="text-cyan-400">{uploadedFile || 'None'}</span></p>
              </div>
            </div>

            {uploadedFile && (
              <div className="bg-black/50 border border-neutral-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white font-mono mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="w-full px-4 py-2 bg-neutral-800 text-white rounded-lg font-mono text-sm hover:bg-neutral-700 transition-colors duration-200"
                  >
                    Upload New File
                  </button>
                  <button 
                    onClick={() => {
                      setUploadedFile(null);
                      setFileCount(0);
                    }}
                    className="w-full px-4 py-2 border border-red-500 text-red-400 rounded-lg font-mono text-sm hover:bg-red-500/10 transition-colors duration-200"
                  >
                    Clear Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* File Upload Modal */}
        {showUploadModal && (
          <FileUploadModal 
            sessionToken={sessionToken}
            onClose={() => setShowUploadModal(false)}
            onUploadSuccess={(fileName: string) => {
              setShowUploadModal(false);
              setUploadedFile(fileName);
              setFileCount(prev => prev + 1);
            }}
          />
        )}

        {/* Developer Credit */}
        <div className="absolute bottom-4 right-4 z-20">
          <p className="text-neutral-400 font-mono text-sm">
            Dev: <span className="text-white font-medium">Samarth Ghante</span>
          </p>
        </div>
      </div>
    </BackgroundLines>
  );
}