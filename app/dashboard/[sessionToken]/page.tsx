"use client";
import { useParams } from "next/navigation";
import { BackgroundLines } from "@/components/ui/background-lines";
import { FileUploadModal } from "@/components/ui/file-upload-modal";
import { useState } from "react";

export default function DashboardPage() {
  const params = useParams();
  const sessionToken = params.sessionToken as string;
  const [showUploadModal, setShowUploadModal] = useState(true);

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-black/50 border border-neutral-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white font-mono mb-4">Database Chat</h2>
              <p className="text-neutral-400 font-mono">Upload a SQL file to start chatting with your database.</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-black/50 border border-neutral-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white font-mono mb-4">Session Info</h3>
              <div className="space-y-2 text-sm font-mono">
                <p className="text-neutral-400">Status: <span className="text-green-400">Active</span></p>
                <p className="text-neutral-400">Files: <span className="text-white">0</span></p>
                <p className="text-neutral-400">Queries: <span className="text-white">0</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload Modal */}
        {showUploadModal && (
          <FileUploadModal 
            sessionToken={sessionToken}
            onClose={() => setShowUploadModal(false)}
            onUploadSuccess={() => {
              setShowUploadModal(false);
              // Refresh dashboard or update state
            }}
          />
        )}
      </div>
    </BackgroundLines>
  );
}