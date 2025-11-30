import React, { useRef, useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PackagePlus, 
  Truck, 
  ExternalLink, 
  Layers, 
  FileSpreadsheet,
  Database,
  Wifi,
  WifiOff,
  X,
  RotateCcw,
  Share2
} from 'lucide-react';
import { InventoryItem } from '../types';
import { downloadBackup, fetchServerInfo } from '../services/dataService';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  inventoryData: InventoryItem[]; // Needed for backup
  onRestoreBackup: (file: File) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  isOpen, 
  onClose,
  isOnline,
  inventoryData,
  onRestoreBackup
}) => {
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
      if (isOnline) {
          fetchServerInfo().then(setServerUrl);
      }
  }, [isOnline]);

  const navItems = [
    { id: 'dashboard', label: '工作台 (概览)', icon: LayoutDashboard },
    { id: 'inbound', label: '来料入库', icon: PackagePlus },
    { id: 'production', label: '生产 / 氧化', icon: Layers },
    { id: 'outsourcing', label: '委外加工', icon: ExternalLink },
    { id: 'outbound', label: '送货 / 对账', icon: Truck },
    { id: 'reports', label: '数据报表', icon: FileSpreadsheet },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          onRestoreBackup(file);
      }
      if (restoreInputRef.current) {
          restoreInputRef.current.value = '';
      }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col no-print shadow-xl z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              OxiTrack Pro
            </h1>
            <p className="text-xs text-slate-400 mt-1">氧化厂生产管理系统</p>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  onClose(); // Close on mobile selection
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Backup Button */}
            <button 
                onClick={() => downloadBackup(inventoryData)}
                className="flex flex-col items-center justify-center space-y-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 py-2 rounded transition"
                title="导出所有数据备份 (JSON)"
            >
                <Database size={16} />
                <span>备份数据</span>
            </button>

            {/* Restore Button */}
            <input 
                type="file" 
                accept=".json" 
                ref={restoreInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
            />
            <button 
                onClick={() => restoreInputRef.current?.click()}
                className="flex flex-col items-center justify-center space-y-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 py-2 rounded transition"
                title="导入之前的备份数据 (JSON)"
            >
                <RotateCcw size={16} />
                <span>恢复数据</span>
            </button>
          </div>

          {/* Status Indicator & Access URL */}
          <div className="flex flex-col space-y-2 bg-slate-950/50 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">系统状态</span>
                <div className="flex items-center space-x-2">
                <span className={isOnline ? "text-green-400" : "text-slate-500"}>
                    {isOnline ? "● 在线同步" : "○ 离线模式"}
                </span>
                {isOnline ? <Wifi size={14} className="text-green-500"/> : <WifiOff size={14} className="text-slate-500"/>}
                </div>
            </div>
            
            {isOnline && serverUrl && (
                <div className="pt-2 border-t border-slate-700/50">
                    <div className="text-[10px] text-slate-500 mb-0.5 flex items-center">
                        <Share2 size={10} className="mr-1"/> 局域网访问地址:
                    </div>
                    <div className="text-xs font-mono text-blue-300 break-all select-all cursor-pointer hover:text-white bg-slate-900 p-1 rounded">
                        {serverUrl}
                    </div>
                </div>
            )}
          </div>
          
          <div className="text-[10px] text-slate-600 text-center mt-2">
            v2.2.1 (Auto-Server)
          </div>
        </div>
      </div>
    </>
  );
};