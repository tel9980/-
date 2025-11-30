import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { DeliveryNote } from './components/DeliveryNote';
import { InventoryItem, OrderStatus, StatusLabels, AppSettings } from './types';
import { fetchInventory, saveInventory, generateId, exportToCSV, parseCSVImport, checkBackendConnection, parseJSONImport, fetchSettings, saveSettings, downloadTemplate } from './services/dataService';
import { analyzePlantStatus } from './services/geminiService';
import { 
  Plus, 
  Search, 
  Save, 
  CheckCircle, 
  AlertTriangle,
  Sparkles,
  Download,
  Upload,
  Trash2,
  Truck,
  Layers,
  ExternalLink,
  RefreshCcw,
  RefreshCw,
  PackagePlus,
  FileSpreadsheet,
  Database,
  CheckSquare,
  Square,
  Calendar,
  ArrowUpDown,
  CheckCheck,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Scissors,
  TrendingUp,
  Award,
  History,
  Menu,
  Banknote,
  Receipt,
  Settings,
  Printer,
  FileDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, PieChart, Pie, Legend } from 'recharts';

const ITEMS_PER_PAGE = 15;

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // App State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Date Filtering
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delivery Note State
  const [printMode, setPrintMode] = useState(false);
  const [printItems, setPrintItems] = useState<InventoryItem[]>([]);
  const [printClient, setPrintClient] = useState('');
  const [printDateOverride, setPrintDateOverride] = useState<string | undefined>(undefined);

  // Outbound View Mode: 'list' (Items) or 'notes' (Delivery Notes Aggregated)
  const [outboundMode, setOutboundMode] = useState<'list' | 'notes'>('list');

  // Form State (Edit & Add & Settings)
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    date: new Date().toISOString().split('T')[0],
    unit: 'pcs',
    isSample: false,
    quantity: 1,
    pricePerUnit: 0,
    status: OrderStatus.INBOUND
  });
  
  const [settingsFormData, setSettingsFormData] = useState<AppSettings>({
      companyName: '', address: '', phone: '', bankInfo: '', footerNote: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived Data for Autocomplete
  const uniqueClients = useMemo(() => Array.from(new Set(inventory.map(i => i.clientName).filter(Boolean))), [inventory]);
  const uniqueProducts = useMemo(() => Array.from(new Set(inventory.map(i => i.productName).filter(Boolean))), [inventory]);
  const uniqueProcessTypes = useMemo(() => Array.from(new Set(inventory.map(i => i.processType).filter(Boolean))), [inventory]);

  // Load data on mount & Poll connection
  useEffect(() => {
    loadData();
    checkConnection();
    const interval = setInterval(checkConnection, 15000); // Check every 15s for faster status updates
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const data = await fetchInventory();
    setInventory(data);
    
    const settings = await fetchSettings();
    setAppSettings(settings);
    setSettingsFormData(settings);
    
    checkConnection();
  };

  const checkConnection = async () => {
      const status = await checkBackendConnection();
      setIsOnline(status);
  };

  // Auto-save on change
  useEffect(() => {
    if (inventory.length > 0) {
      saveInventory(inventory);
    }
  }, [inventory]);

  // Reset pagination/selection when view changes
  useEffect(() => {
    setSelectedIds(new Set());
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
    setCurrentPage(1);
    setIsSidebarOpen(false); // Close sidebar on nav
    setOutboundMode('list'); // Reset outbound mode
  }, [currentView]);

  // Auto-Fill Logic: Price Memory
  useEffect(() => {
    if (showForm && !editingId && formData.clientName && formData.productName) {
        const lastRecord = inventory.find(i => 
            i.clientName === formData.clientName && 
            i.productName === formData.productName &&
            !i.isSample &&
            i.pricePerUnit > 0
        );

        if (lastRecord) {
            if (formData.pricePerUnit === 0) {
                setFormData(prev => ({
                    ...prev,
                    pricePerUnit: lastRecord.pricePerUnit,
                    unit: lastRecord.unit,
                    processType: prev.processType || lastRecord.processType
                }));
            }
        }
    }
  }, [formData.clientName, formData.productName, showForm, editingId, inventory]);


  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      unit: 'pcs',
      isSample: false,
      quantity: 1,
      pricePerUnit: 0,
      status: OrderStatus.INBOUND,
      clientName: '',
      productName: '',
      processType: '',
      notes: ''
    });
    setShowForm(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setEditingId(item.id);
    setFormData({ ...item });
    setShowForm(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.productName) return;

    if (editingId) {
      setInventory(inventory.map(item => 
        item.id === editingId 
        ? { ...item, ...formData as InventoryItem, id: editingId } 
        : item
      ));
    } else {
      const newItem: InventoryItem = {
        ...formData as InventoryItem,
        id: generateId(),
        pricePerUnit: formData.isSample ? 0 : Number(formData.pricePerUnit),
        quantity: Number(formData.quantity)
      };
      setInventory([newItem, ...inventory]);
    }
    
    setShowForm(false);
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await saveSettings(settingsFormData);
      setAppSettings(settingsFormData);
      setShowSettings(false);
      alert('设置已保存并同步！局域网内其他电脑刷新页面后生效。');
  };

  const handleFactoryReset = async () => {
      if (confirm('危险：此操作将清空所有库存数据且不可恢复！\n\n您确定要重置系统吗？\n(建议先进行数据备份)')) {
          if (confirm('请再次确认：您真的要删除所有数据吗？')) {
              setInventory([]);
              await saveInventory([]);
              setShowSettings(false);
              alert('系统已重置。');
          }
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const newItems = await parseCSVImport(file);
        setInventory([...newItems, ...inventory]);
        alert(`成功导入 ${newItems.length} 条数据`);
      } catch (err) {
        alert("导入失败，请检查文件格式");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleJSONRestore = async (file: File) => {
      try {
          const restoredItems = await parseJSONImport(file);
          const confirmReplace = confirm(
              `检测到备份文件包含 ${restoredItems.length} 条记录。\n\n` + 
              `点击【确定】清空当前数据并完全覆盖 (推荐)。\n` + 
              `点击【取消】将数据追加到当前列表 (可能产生重复)。`
          );

          if (confirmReplace) {
              setInventory(restoredItems);
              alert("数据已成功恢复！");
          } else {
              const currentIds = new Set(inventory.map(i => i.id));
              const newItems = restoredItems.filter(i => !currentIds.has(i.id));
              setInventory([...newItems, ...inventory]);
              alert(`已追加 ${newItems.length} 条新记录 (跳过 ${restoredItems.length - newItems.length} 条重复记录)。`);
          }
      } catch (e) {
          alert("恢复失败：文件格式错误或已损坏。");
          console.error(e);
      }
  };

  const updateStatus = (id: string, newStatus: OrderStatus, extra?: Partial<InventoryItem>) => {
    setInventory(inventory.map(item => 
      item.id === id ? { ...item, status: newStatus, ...extra } : item
    ));
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      setInventory(inventory.filter(i => i.id !== id));
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    }
  };

  const handleSplit = (item: InventoryItem) => {
    const splitQtyStr = prompt(`当前单据数量: ${item.quantity}\n请输入要拆分出来的数量 (生成的订单将保留当前状态):`);
    if (!splitQtyStr) return;
    const splitQty = Number(splitQtyStr);
    
    if (isNaN(splitQty) || splitQty <= 0 || splitQty >= item.quantity) {
      alert("无效的数量！拆分数量必须大于0且小于当前总数。");
      return;
    }

    const newMainQty = item.quantity - splitQty;
    
    const updatedOriginal = { ...item, quantity: newMainQty };
    
    const newItem = {
      ...item,
      id: generateId(),
      quantity: splitQty,
      notes: (item.notes || '') + ' (拆单)'
    };

    setInventory(prev => [newItem, ...prev.map(i => i.id === item.id ? updatedOriginal : i)]);
  };

  const handleBatchDelete = () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;
    setInventory(inventory.filter(i => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
  };

  const handleBatchStatusUpdate = (newStatus: OrderStatus, extra?: Partial<InventoryItem>) => {
     if (!confirm(`确定更新选中的 ${selectedIds.size} 条记录状态为“${StatusLabels[newStatus]}”吗？`)) return;
     setInventory(inventory.map(i => selectedIds.has(i.id) ? { ...i, status: newStatus, ...extra } : i));
     setSelectedIds(new Set());
  };

  const handleBatchOutsource = () => {
     const vendor = prompt("请输入批量外发加工厂商名称 (如: XX喷砂厂):");
     if (!vendor) return;
     handleBatchStatusUpdate(OrderStatus.OUTSOURCED, { outsourcingVendor: vendor });
  };

  const handleGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzePlantStatus(inventory);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const loadDemoData = () => {
    if(!confirm("加载测试数据将帮助您快速体验系统功能。确定加载吗？")) return;
    
    const demoData: InventoryItem[] = [
      { id: generateId(), date: new Date().toISOString().split('T')[0], clientName: '永信五金', productName: '铝合金手机支架', processType: '喷砂氧化黑', quantity: 500, unit: 'pcs', pricePerUnit: 1.5, isSample: false, status: OrderStatus.FINISHED, notes: '急单', isPaid: false },
      { id: generateId(), date: new Date().toISOString().split('T')[0], clientName: '永信五金', productName: '耳机外壳', processType: '高光切边', quantity: 2000, unit: 'pcs', pricePerUnit: 0.8, isSample: false, status: OrderStatus.FINISHED, notes: '', isPaid: false },
      { id: generateId(), date: '2023-10-26', clientName: '华力电子', productName: '散热器', processType: '本色氧化', quantity: 100, unit: 'kg', pricePerUnit: 12, isSample: false, status: OrderStatus.PROCESSING, notes: '注意保护' },
      { id: generateId(), date: '2023-10-27', clientName: '华力电子', productName: '面板', processType: '拉丝', quantity: 50, unit: 'pcs', pricePerUnit: 0, isSample: true, status: OrderStatus.INBOUND, notes: '新样板' },
      { id: generateId(), date: '2023-10-24', clientName: '精工制造', productName: '轴承套', processType: '硬质氧化', quantity: 200, unit: 'pcs', pricePerUnit: 5, isSample: false, status: OrderStatus.OUTSOURCED, outsourcingVendor: '宏达抛光', notes: '' },
    ];
    setInventory([...demoData, ...inventory]);
    alert('测试数据已加载！请前往“送货 / 对账”页面。');
  };

  const handleSort = (key: keyof InventoryItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredItems = useMemo(() => {
    let items = inventory;
    
    if (currentView === 'inbound') items = items.filter(i => i.status === OrderStatus.INBOUND);
    if (currentView === 'production') items = items.filter(i => i.status === OrderStatus.PROCESSING || i.status === OrderStatus.RETURNED);
    if (currentView === 'outsourcing') items = items.filter(i => i.status === OrderStatus.OUTSOURCED);
    if (currentView === 'outbound') items = items.filter(i => i.status === OrderStatus.FINISHED || i.status === OrderStatus.DELIVERED);
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(i => 
        i.clientName.toLowerCase().includes(lower) || 
        i.productName.toLowerCase().includes(lower) ||
        i.processType.toLowerCase().includes(lower) ||
        (i.outsourcingVendor && i.outsourcingVendor.toLowerCase().includes(lower)) ||
        (i.deliveryNoteId && i.deliveryNoteId.toLowerCase().includes(lower))
      );
    }

    if (dateRange.start) {
        items = items.filter(i => i.date >= dateRange.start);
    }
    if (dateRange.end) {
        items = items.filter(i => i.date <= dateRange.end);
    }

    if (sortConfig) {
      items = [...items].sort((a, b) => {
        if (a[sortConfig.key]! < b[sortConfig.key]!) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key]! > b[sortConfig.key]!) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [inventory, currentView, searchTerm, dateRange, sortConfig]);

  // Aggregated Delivery Notes (For Reconciliation View)
  const deliveryNotes = useMemo(() => {
      const notes: Record<string, { id: string, client: string, date: string, amount: number, isPaid: boolean, count: number }> = {};
      
      filteredItems.forEach(item => {
          if (item.deliveryNoteId) {
              if (!notes[item.deliveryNoteId]) {
                  notes[item.deliveryNoteId] = {
                      id: item.deliveryNoteId,
                      client: item.clientName,
                      date: item.deliveryDate || item.date, // Prioritize actual delivery date
                      amount: 0,
                      isPaid: !!item.isPaid, 
                      count: 0
                  };
              }
              const val = item.isSample ? 0 : (item.quantity * item.pricePerUnit);
              notes[item.deliveryNoteId].amount += val;
              notes[item.deliveryNoteId].count += 1;
          }
      });
      return Object.values(notes).sort((a,b) => b.id.localeCompare(a.id));
  }, [filteredItems]);

  const toggleNotePaid = (noteId: string, currentStatus: boolean) => {
      const newStatus = !currentStatus;
      setInventory(prev => prev.map(item => 
          item.deliveryNoteId === noteId 
            ? { ...item, isPaid: newStatus }
            : item
      ));
  };

  const handleReprintNote = (noteId: string) => {
      const items = inventory.filter(i => i.deliveryNoteId === noteId);
      if (items.length > 0) {
          setPrintClient(items[0].clientName);
          setPrintItems(items);
          // Use the delivery date from the first item to reproduce exact history
          setPrintDateOverride(items[0].deliveryDate);
          setPrintMode(true);
      } else {
          alert('找不到该单号对应的订单数据');
      }
  };


  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    const currentPageIds = paginatedItems.map(i => i.id);
    const allSelected = currentPageIds.every(id => selectedIds.has(id));
    
    const newSet = new Set(selectedIds);
    if (allSelected) {
      currentPageIds.forEach(id => newSet.delete(id));
    } else {
      currentPageIds.forEach(id => newSet.add(id));
    }
    setSelectedIds(newSet);
  };

  const stats = {
    pending: inventory.filter(i => i.status === OrderStatus.INBOUND || i.status === OrderStatus.PROCESSING).length,
    outsourced: inventory.filter(i => i.status === OrderStatus.OUTSOURCED).length,
    ready: inventory.filter(i => i.status === OrderStatus.FINISHED).length,
    todayIn: inventory.filter(i => i.date === new Date().toISOString().split('T')[0]).length
  };

  const chartData = [
    { name: '待加工', value: inventory.filter(i => i.status === OrderStatus.INBOUND).length, color: '#94a3b8' },
    { name: '生产中', value: inventory.filter(i => i.status === OrderStatus.PROCESSING).length, color: '#6366f1' },
    { name: '委外中', value: stats.outsourced, color: '#f59e0b' },
    { name: '待送货', value: stats.ready, color: '#10b981' },
  ];

  const clientRevenueData = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    inventory.forEach(item => {
        if (!item.isSample) {
            revenueMap[item.clientName] = (revenueMap[item.clientName] || 0) + (item.quantity * item.pricePerUnit);
        }
    });
    return Object.entries(revenueMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
  }, [inventory]);

  const prepareDeliveryNote = () => {
    const selectedItemsList = inventory.filter(i => selectedIds.has(i.id));

    if (selectedItemsList.length === 0) {
      alert("请先勾选需要送货的订单。");
      return;
    }

    const client = selectedItemsList[0].clientName;
    const sameClient = selectedItemsList.every(i => i.clientName === client);
    
    if (!sameClient) {
      alert("错误：您勾选了不同客户的订单！\n一张送货单只能包含同一个客户的产品。");
      return;
    }

    setPrintClient(client);
    setPrintItems(selectedItemsList);
    setPrintDateOverride(undefined); // New note, use today
    setPrintMode(true);
  };
  
  const handleDeliveryConfirmed = (orderNo: string) => {
      // NOTE: We capture the Delivery Date when the user actually confirms the delivery
      const todayStr = new Date().toISOString().split('T')[0];
      
      setInventory(prev => prev.map(item => 
          selectedIds.has(item.id) 
            ? { 
                ...item, 
                status: OrderStatus.DELIVERED, 
                deliveryNoteId: orderNo, 
                deliveryDate: todayStr, // Save the actual delivery date
                isPaid: false 
              } 
            : item
      ));
      setSelectedIds(new Set());
      setPrintMode(false);
  };

  if (printMode && appSettings) {
    return <DeliveryNote items={printItems} clientName={printClient} currentSettings={appSettings} onConfirmDelivery={handleDeliveryConfirmed} onClose={() => setPrintMode(false)} initialDate={printDateOverride} />;
  }

  const getViewTitle = () => {
     switch(currentView) {
        case 'dashboard': return '工作台概览';
        case 'inbound': return '来料入库登记';
        case 'production': return '车间生产管理';
        case 'outsourcing': return '委外加工管理';
        case 'outbound': return '送货与对账';
        case 'reports': return '报表数据中心';
        default: return 'OxiTrack Pro';
     }
  };

  const ReportsView = () => (
    <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                    <Award className="mr-2 text-yellow-500"/> 客户产值排行 (Top 10)
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={clientRevenueData} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" tickFormatter={(val) => `¥${val}`}/>
                            <YAxis dataKey="name" type="category" width={100} />
                            <Tooltip formatter={(val) => `¥${Number(val).toFixed(2)}`} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                    <TrendingUp className="mr-2 text-blue-500"/> 订单状态分布
                </h3>
                <div className="h-80 flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={chartData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={60} 
                                outerRadius={100} 
                                paddingAngle={5}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
                财务概况 (基于已录入数据)
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div>
                    <div className="text-sm text-slate-500 mb-1">总订单数</div>
                    <div className="text-3xl font-bold text-slate-800">{inventory.length}</div>
                </div>
                <div>
                    <div className="text-sm text-slate-500 mb-1">预计总产值</div>
                    <div className="text-3xl font-bold text-blue-600">
                        ¥{inventory.reduce((sum, i) => sum + (i.isSample ? 0 : i.quantity * i.pricePerUnit), 0).toLocaleString()}
                    </div>
                </div>
                <div>
                    <div className="text-sm text-slate-500 mb-1">已结账金额 (收回款)</div>
                    <div className="text-3xl font-bold text-emerald-600">
                        ¥{inventory.filter(i => i.isPaid).reduce((sum, i) => sum + (i.isSample ? 0 : i.quantity * i.pricePerUnit), 0).toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isOnline={isOnline}
        inventoryData={inventory}
        onRestoreBackup={handleJSONRestore}
      />

      <main className="md:ml-64 flex-1 h-screen flex flex-col w-full relative">
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-30">
             <div className="flex items-center space-x-3">
                 <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
                     <Menu size={24} />
                 </button>
                 <span className="font-bold text-slate-800">OxiTrack Pro</span>
             </div>
             <div className="flex items-center space-x-2">
                 {isOnline ? <div className="w-2 h-2 bg-green-500 rounded-full"/> : <div className="w-2 h-2 bg-slate-300 rounded-full"/>}
             </div>
        </div>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    {getViewTitle()}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                    {currentView === 'dashboard' ? '实时监控工厂生产进度与库存状态。' : '管理您的日常业务单据。'}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                
                {/* Global Settings Button */}
                <button 
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded-lg shadow-sm transition"
                    title="全局系统设置 (厂名/地址/账号)"
                >
                    <Settings size={20} />
                </button>

                <button onClick={loadData} className="p-2 text-slate-400 hover:text-slate-600 transition" title="刷新数据">
                <RefreshCw size={20} />
                </button>
                {currentView === 'dashboard' && (
                <>
                <button 
                    onClick={loadDemoData}
                    className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 hover:shadow-sm transition text-sm"
                >
                    <Database size={16} />
                    <span>加载测试数据</span>
                </button>
                <button 
                    onClick={handleGeminiAnalysis}
                    className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition disabled:opacity-50 text-sm"
                    disabled={isAnalyzing}
                >
                    <Sparkles size={16} />
                    <span>{isAnalyzing ? '分析中...' : 'AI 智能分析'}</span>
                </button>
                </>
                )}
                <button 
                onClick={openAddForm}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md transition transform active:scale-95 text-sm"
                >
                <Plus size={18} />
                <span>新增入库单</span>
                </button>
            </div>
            </div>

            {aiAnalysis && currentView === 'dashboard' && (
            <div className="mb-8 p-6 bg-white border-l-4 border-purple-500 rounded-r-xl shadow-sm text-slate-700 leading-relaxed relative overflow-hidden animate-in fade-in slide-in-from-top-4">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles size={100} />
                </div>
                <h3 className="font-bold text-purple-800 mb-3 flex items-center text-lg"><Sparkles size={20} className="mr-2"/> 生产建议报告</h3>
                <p className="whitespace-pre-line">{aiAnalysis}</p>
            </div>
            )}

            {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-slate-500 text-xs font-bold uppercase">今日入库</h3>
                <div className="flex items-end justify-between mt-2">
                    <p className="text-3xl font-bold text-slate-800">{stats.todayIn}</p>
                    <PackagePlus size={24} className="text-blue-200" />
                </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-slate-500 text-xs font-bold uppercase">车间在制</h3>
                <div className="flex items-end justify-between mt-2">
                    <p className="text-3xl font-bold text-indigo-600">{stats.pending}</p>
                    <Layers size={24} className="text-indigo-200" />
                </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-slate-500 text-xs font-bold uppercase">外发加工中</h3>
                <div className="flex items-end justify-between mt-2">
                    <p className="text-3xl font-bold text-orange-600">{stats.outsourced}</p>
                    <ExternalLink size={24} className="text-orange-200" />
                </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-slate-500 text-xs font-bold uppercase">待送货成品</h3>
                <div className="flex items-end justify-between mt-2">
                    <p className="text-3xl font-bold text-emerald-600">{stats.ready}</p>
                    <Truck size={24} className="text-emerald-200" />
                </div>
                </div>
                
                <div className="col-span-4 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
                <h3 className="text-slate-700 font-bold mb-6">实时库存分布图</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 14, fill: '#64748b'}} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="value" barSize={30} radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </div>
            </div>
            )}

            {currentView === 'reports' ? (
                <ReportsView />
            ) : (
                currentView !== 'dashboard' && (
                <>
                <div className="space-y-4 mb-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4 justify-between items-center shadow-sm">
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                type="text" 
                                placeholder="搜索客户、产品、单号..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-56 text-sm bg-slate-50"
                                />
                            </div>
                            
                            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
                                <Calendar size={16} className="text-slate-400" />
                                <input 
                                    type="date" 
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                                    className="bg-transparent text-sm text-slate-600 outline-none w-28"
                                    placeholder="开始日期"
                                />
                                <span className="text-slate-300">-</span>
                                <input 
                                    type="date" 
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                                    className="bg-transparent text-sm text-slate-600 outline-none w-28"
                                    placeholder="结束日期"
                                />
                                {(dateRange.start || dateRange.end) && (
                                    <button onClick={() => setDateRange({start: '', end: ''})} className="text-slate-400 hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            {/* Toggle Switch for Outbound Mode */}
                            {currentView === 'outbound' && (
                                <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
                                    <button 
                                        onClick={() => setOutboundMode('list')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center ${outboundMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Layers size={14} className="mr-1.5"/> 订单明细
                                    </button>
                                    <button 
                                        onClick={() => setOutboundMode('notes')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center ${outboundMode === 'notes' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Receipt size={14} className="mr-1.5"/> 单据对账
                                    </button>
                                </div>
                            )}

                            <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                            
                            <div className="flex space-x-1">
                                <button onClick={() => fileInputRef.current?.click()} className="hidden md:flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition" title="导入CSV数据"><Upload size={16} /><span>导入</span></button>
                                <button onClick={downloadTemplate} className="hidden md:flex items-center space-x-1 px-2 py-2 bg-slate-100 hover:bg-blue-100 text-blue-600 rounded-lg text-sm transition" title="下载导入模板"><FileDown size={16} /></button>
                            </div>

                            <button onClick={() => exportToCSV(filteredItems, `oxitrack_${currentView}_${new Date().toLocaleDateString()}.csv`)} className="hidden md:flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition"><Download size={16} /><span>导出CSV</span></button>
                        </div>
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex justify-between items-center animate-in fade-in slide-in-from-top-2 overflow-x-auto">
                            <span className="text-blue-700 font-medium text-sm flex items-center ml-2 whitespace-nowrap mr-4">
                                <CheckSquare size={16} className="mr-2"/> 已选择 {selectedIds.size} 项
                            </span>
                            <div className="flex space-x-3 whitespace-nowrap">
                                {currentView === 'outbound' && (
                                    <button 
                                        onClick={prepareDeliveryNote}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition shadow-sm"
                                    >
                                        <Truck size={14} /> 
                                        <span>
                                            {selectedIds.size > 0 && inventory.find(i => selectedIds.has(i.id))?.status === OrderStatus.DELIVERED
                                                ? '补打送货单'
                                                : '生成送货单'}
                                        </span>
                                    </button>
                                )}
                                
                                {(currentView === 'production' || currentView === 'outsourcing') && (
                                    <button 
                                        onClick={() => handleBatchStatusUpdate(OrderStatus.FINISHED)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm transition shadow-sm"
                                    >
                                        <CheckCircle size={14} /> <span>批量完成</span>
                                    </button>
                                )}

                                {(currentView === 'production' || currentView === 'inbound') && (
                                    <button 
                                        onClick={handleBatchOutsource}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm transition shadow-sm"
                                    >
                                        <ExternalLink size={14} /> <span>批量外发</span>
                                    </button>
                                )}

                                {currentView === 'outbound' && (
                                    <button 
                                        onClick={() => handleBatchStatusUpdate(OrderStatus.DELIVERED)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition shadow-sm"
                                    >
                                        <CheckCheck size={14} /> <span>标记已送货</span>
                                    </button>
                                )}

                                <button 
                                    onClick={handleBatchDelete}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded text-sm transition"
                                >
                                    <Trash2 size={14} /> <span>批量删除</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                {currentView === 'outbound' && outboundMode === 'notes' ? (
                    // Delivery Note Reconciliation View
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                            <span className="flex items-center"><Receipt className="mr-2"/> 送货单对账列表 (自动合并)</span>
                            <span className="text-xs font-normal text-slate-500">仅显示有单号的记录</span>
                        </div>
                        {deliveryNotes.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">暂无已生成的送货单</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="p-4">送货单号</th>
                                            <th className="p-4">客户名称</th>
                                            <th className="p-4">送货日期</th>
                                            <th className="p-4 text-center">包含订单数</th>
                                            <th className="p-4 text-right">总金额</th>
                                            <th className="p-4 text-center">结账状态</th>
                                            <th className="p-4 text-center">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {deliveryNotes.map(note => (
                                            <tr key={note.id} className={`hover:bg-slate-50 transition ${note.isPaid ? 'bg-emerald-50/30' : ''}`}>
                                                <td className="p-4 font-mono font-medium text-slate-700">{note.id.replace('NO:', '')}</td>
                                                <td className="p-4 font-bold text-slate-800">{note.client}</td>
                                                <td className="p-4 text-slate-500">{note.date}</td>
                                                <td className="p-4 text-center">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{note.count}</span>
                                                </td>
                                                <td className="p-4 text-right font-medium text-lg">
                                                    ¥{note.amount.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {note.isPaid ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                            <CheckCheck size={12} className="mr-1"/> 已结清
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600">
                                                            <AlertTriangle size={12} className="mr-1"/> 未结账
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center flex items-center justify-center space-x-2">
                                                    <button 
                                                        onClick={() => toggleNotePaid(note.id, note.isPaid)}
                                                        className={`p-2 rounded transition ${note.isPaid ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:bg-blue-50'}`}
                                                        title={note.isPaid ? "标记为未付款" : "标记为已付款"}
                                                    >
                                                        {note.isPaid ? <RefreshCcw size={16}/> : <Banknote size={18}/>}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleReprintNote(note.id)}
                                                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                        title="查看详情 / 补打送货单"
                                                    >
                                                        <Printer size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    // Standard Item List View
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 min-h-[400px] flex flex-col">
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 min-w-[800px]">
                            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                                <tr>
                                <th className="p-4 w-10 text-center">
                                    <button onClick={toggleSelectAll} className="text-slate-500 hover:text-blue-600">
                                        {paginatedItems.length > 0 && paginatedItems.every(i => selectedIds.has(i.id)) ? <CheckSquare size={18}/> : <Square size={18}/>}
                                    </button>
                                </th>
                                <th className="p-4 w-28 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('date')}>
                                    <div className="flex items-center">
                                        入库日期 
                                        {sortConfig?.key === 'date' && <ArrowUpDown size={12} className="ml-1 text-blue-500" />}
                                    </div>
                                </th>
                                <th className="p-4 w-40 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('clientName')}>
                                    <div className="flex items-center">
                                        客户名称
                                        {sortConfig?.key === 'clientName' && <ArrowUpDown size={12} className="ml-1 text-blue-500" />}
                                    </div>
                                </th>
                                <th className="p-4">产品 / 备注</th>
                                <th className="p-4">工艺要求</th>
                                <th className="p-4">数量</th>
                                <th className="p-4 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('status')}>
                                    <div className="flex items-center">
                                        当前状态
                                        {sortConfig?.key === 'status' && <ArrowUpDown size={12} className="ml-1 text-blue-500" />}
                                    </div>
                                </th>
                                <th className="p-4 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center">
                                        <FileSpreadsheet size={48} className="mb-2 opacity-20" />
                                        <p>暂无相关记录</p>
                                    </div>
                                    </td>
                                </tr>
                                ) : (
                                paginatedItems.map(item => (
                                    <tr key={item.id} className={`border-b border-slate-100 hover:bg-slate-50 transition group ${selectedIds.has(item.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-4 text-center">
                                        <button onClick={() => toggleSelection(item.id)} className={`${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300'} hover:text-blue-600`}>
                                            {selectedIds.has(item.id) ? <CheckSquare size={18}/> : <Square size={18}/>}
                                        </button>
                                    </td>
                                    <td className="p-4 whitespace-nowrap text-slate-500">{item.date}</td>
                                    <td className="p-4 font-bold text-slate-800">{item.clientName}</td>
                                    <td className="p-4">
                                        <div className="font-medium text-slate-900">{item.productName}</div>
                                        {item.isSample && <span className="text-[10px] uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full mr-2">样板免费</span>}
                                        {item.notes && <span className="text-xs text-slate-400 bg-slate-100 px-1 rounded">{item.notes}</span>}
                                    </td>
                                    <td className="p-4 text-slate-700">{item.processType}</td>
                                    <td className="p-4 font-medium">{item.quantity} <span className="text-slate-400 text-xs">{item.unit}</span></td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                        ${item.status === OrderStatus.INBOUND ? 'bg-blue-100 text-blue-800' : ''}
                                        ${item.status === OrderStatus.PROCESSING ? 'bg-indigo-100 text-indigo-800' : ''}
                                        ${item.status === OrderStatus.OUTSOURCED ? 'bg-orange-100 text-orange-800' : ''}
                                        ${item.status === OrderStatus.FINISHED ? 'bg-emerald-100 text-emerald-800' : ''}
                                        ${item.status === OrderStatus.DELIVERED ? 'bg-gray-100 text-gray-600' : ''}
                                        ${item.status === OrderStatus.RETURNED ? 'bg-red-100 text-red-800' : ''}
                                        `}>
                                        {StatusLabels[item.status]}
                                        </span>
                                        {item.outsourcingVendor && (
                                        <div className="text-xs mt-1 text-orange-600 font-medium">@ {item.outsourcingVendor}</div>
                                        )}
                                        {item.status === OrderStatus.DELIVERED && item.deliveryNoteId && (
                                            <div className="flex flex-col mt-1 space-y-1">
                                                <div className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 rounded inline-block" title="送货单号">
                                                    NO.{item.deliveryNoteId.split('NO:')[1] || item.deliveryNoteId}
                                                </div>
                                                {item.deliveryDate && (
                                                    <div className="text-[10px] text-slate-400 flex items-center">
                                                        <Truck size={10} className="mr-0.5"/> {item.deliveryDate}
                                                    </div>
                                                )}
                                                {item.isPaid && <div className="text-[10px] text-emerald-600 font-bold">已结账</div>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            {/* Split Order Button */}
                                            {item.quantity > 1 && item.status !== OrderStatus.DELIVERED && (
                                                <button
                                                    onClick={() => handleSplit(item)}
                                                    className="bg-slate-50 text-slate-500 p-1.5 rounded hover:bg-purple-50 hover:text-purple-600" title="拆分订单"
                                                >
                                                    <Scissors size={14} />
                                                </button>
                                            )}

                                            {/* Edit Button */}
                                            <button 
                                                onClick={() => openEditForm(item)}
                                                className="bg-slate-50 text-slate-600 p-1.5 rounded hover:bg-blue-50 hover:text-blue-600" title="编辑信息"
                                            >
                                                <Pencil size={14} />
                                            </button>

                                            {/* Inbound -> Processing */}
                                            {item.status === OrderStatus.INBOUND && (
                                            <button 
                                                onClick={() => updateStatus(item.id, OrderStatus.PROCESSING)}
                                                className="bg-indigo-50 text-indigo-600 p-1.5 rounded hover:bg-indigo-100 flex items-center space-x-1" title="开始生产"
                                            >
                                                <Layers size={14} />
                                            </button>
                                            )}
                                            
                                            {/* Processing/Returned -> Outsource OR Finish */}
                                            {(item.status === OrderStatus.PROCESSING || item.status === OrderStatus.RETURNED) && (
                                            <>
                                                <button 
                                                onClick={() => {
                                                    const vendor = prompt("请输入外发加工厂商名称 (如: XX喷砂厂):");
                                                    if(vendor) updateStatus(item.id, OrderStatus.OUTSOURCED, { outsourcingVendor: vendor });
                                                }}
                                                className="bg-orange-50 text-orange-600 p-1.5 rounded hover:bg-orange-100 flex items-center space-x-1" title="外发加工"
                                                >
                                                <ExternalLink size={14} />
                                                </button>
                                                <button 
                                                onClick={() => updateStatus(item.id, OrderStatus.FINISHED)}
                                                className="bg-emerald-50 text-emerald-600 p-1.5 rounded hover:bg-emerald-100 flex items-center space-x-1" title="生产完成"
                                                >
                                                <CheckCircle size={14} />
                                                </button>
                                            </>
                                            )}

                                            {/* Outsource -> Processing (Back to factory) */}
                                            {item.status === OrderStatus.OUTSOURCED && (
                                            <button 
                                                onClick={() => updateStatus(item.id, OrderStatus.PROCESSING, { outsourcingVendor: undefined, notes: (item.notes || '') + ' [外发已回]' })}
                                                className="bg-blue-50 text-blue-600 p-1.5 rounded hover:bg-blue-100 flex items-center space-x-1" title="外发回厂"
                                            >
                                                <RefreshCcw size={14} />
                                            </button>
                                            )}

                                            {/* Finished -> Return (Rework) or Delivered */}
                                            {item.status === OrderStatus.FINISHED && (
                                                <>
                                                <button 
                                                    onClick={() => updateStatus(item.id, OrderStatus.DELIVERED)}
                                                    className="bg-gray-100 text-gray-600 p-1.5 rounded hover:bg-gray-200 flex items-center space-x-1" title="确认送货"
                                                >
                                                    <Truck size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => updateStatus(item.id, OrderStatus.RETURNED, { notes: '返工重做' })}
                                                    className="bg-red-50 text-red-500 p-1.5 rounded hover:bg-red-100 flex items-center space-x-1" title="返工"
                                                >
                                                    <AlertTriangle size={14} />
                                                </button>
                                                </>
                                            )}
                                            <button onClick={() => handleDelete(item.id)} className="bg-slate-50 text-slate-400 p-1.5 rounded hover:bg-slate-100 hover:text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                    </tr>
                                ))
                                )}
                            </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="bg-white border-t border-slate-200 p-3 flex justify-between items-center">
                                <span className="text-sm text-slate-500">
                                    显示第 <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> 到 <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}</span> 条，共 {filteredItems.length} 条
                                </span>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 px-3 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center"
                                    >
                                        <ChevronLeft size={16} /> 上一页
                                    </button>
                                    <span className="flex items-center text-sm font-medium text-slate-700 px-2">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1 px-3 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center"
                                    >
                                        下一页 <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                </>
                )
            )}

        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center">
                        <Settings className="mr-2 text-slate-600"/> 系统全局设置
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={handleSettingsSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-slate-500 bg-blue-50 p-3 rounded mb-4">
                        在此设置的信息将作为默认值应用到所有新的送货单中。局域网内的所有电脑将同步这些设置。
                    </p>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">工厂名称</label>
                        <input required type="text" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={settingsFormData.companyName} onChange={e => setSettingsFormData({...settingsFormData, companyName: e.target.value})} />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">工厂地址</label>
                        <input required type="text" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={settingsFormData.address} onChange={e => setSettingsFormData({...settingsFormData, address: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">联系电话</label>
                        <input required type="text" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={settingsFormData.phone} onChange={e => setSettingsFormData({...settingsFormData, phone: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">银行账户信息 (显示在页脚)</label>
                        <input required type="text" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={settingsFormData.bankInfo} onChange={e => setSettingsFormData({...settingsFormData, bankInfo: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">页脚备注 / 免责声明</label>
                        <textarea className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none" 
                            value={settingsFormData.footerNote} onChange={e => setSettingsFormData({...settingsFormData, footerNote: e.target.value})} />
                    </div>

                    <div className="pt-4 flex justify-between space-x-3 items-center border-t border-slate-100 mt-4">
                        <button type="button" onClick={handleFactoryReset} className="text-red-500 text-xs hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition">
                            危险：清空所有数据
                        </button>
                        <div className="flex space-x-3">
                            <button type="button" onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                            <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-lg flex items-center font-medium">
                                <Save size={18} className="mr-2" /> 保存并同步
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Add/Edit Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 flex items-center">
                  <PackagePlus className="mr-2 text-blue-600"/> {editingId ? '编辑单据信息' : '新增入库登记'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              
              {/* Autocomplete Datalists */}
              <datalist id="clientNames">
                {uniqueClients.map(c => <option key={c} value={c} />)}
              </datalist>
              <datalist id="productNames">
                {uniqueProducts.map(p => <option key={p} value={p} />)}
              </datalist>
              <datalist id="processTypes">
                {uniqueProcessTypes.map(p => <option key={p} value={p} />)}
              </datalist>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">入库日期</label>
                  <input required type="date" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">客户名称</label>
                  <input required type="text" list="clientNames" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="输入或选择客户"
                    value={formData.clientName || ''} onChange={e => setFormData({...formData, clientName: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">产品名称</label>
                <div className="relative">
                    <input required type="text" list="productNames" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="输入或选择产品 (自动匹配单价)"
                    value={formData.productName || ''} onChange={e => setFormData({...formData, productName: e.target.value})} />
                     {!editingId && (
                         <span className="absolute right-2 top-2 text-xs text-blue-400 pointer-events-none bg-white px-1">
                             <History size={12} className="inline mr-1"/>智能记忆
                         </span>
                     )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">工艺 / 颜色要求</label>
                <input required type="text" list="processTypes" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例如: 哑黑, 喷砂银"
                  value={formData.processType || ''} onChange={e => setFormData({...formData, processType: e.target.value})} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">数量</label>
                  <input required type="number" min="1" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">单位</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                    value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as any})}>
                    <option value="pcs">件 (pcs)</option>
                    <option value="kg">公斤 (kg)</option>
                    <option value="set">套 (set)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">单价 (元)</label>
                  <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={formData.isSample}
                    value={formData.pricePerUnit} onChange={e => setFormData({...formData, pricePerUnit: Number(e.target.value)})} />
                </div>
              </div>
              
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">备注</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="可选备注信息"
                  value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>

              {/* Status Correction (Only Visible in Edit Mode) */}
              {editingId && (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                      <label className="block text-xs font-bold text-red-500 uppercase mb-1 flex items-center">
                          <AlertTriangle size={12} className="mr-1"/> 强制更改状态 (管理员修正)
                      </label>
                      <select 
                        className="w-full border border-red-200 rounded-lg p-2 bg-white text-sm"
                        value={formData.status} 
                        onChange={e => setFormData({...formData, status: e.target.value as OrderStatus})}
                      >
                          {Object.values(OrderStatus).map(s => (
                              <option key={s} value={s}>{StatusLabels[s]}</option>
                          ))}
                      </select>
                  </div>
              )}

              <div className="flex items-center space-x-2 pt-2 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                <input type="checkbox" id="isSample" className="w-4 h-4 text-blue-600 rounded"
                  checked={formData.isSample} onChange={e => setFormData({...formData, isSample: e.target.checked})} />
                <label htmlFor="isSample" className="text-sm text-slate-700 select-none font-medium">这是样板 (免费 / Free)</label>
              </div>
              
              <div className="pt-4 flex justify-end space-x-3">
                 <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                 <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg flex items-center font-medium">
                   <Save size={18} className="mr-2" /> {editingId ? '保存修改' : '确认登记'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;