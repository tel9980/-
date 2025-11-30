import { InventoryItem, OrderStatus, AppSettings } from '../types';

const STORAGE_KEY = 'oxitrack_db_v1';
const SETTINGS_KEY = 'oxitrack_settings_v1';

// Detect if we are in dev mode (React running on 3000/5173) or prod (served by python)
const isDev = window.location.port === '3000' || window.location.port === '5173';
// If dev, assume python server is on 8000. If prod, use relative path.
const API_BASE = isDev ? `http://${window.location.hostname}:8000` : '';
const API_URL = `${API_BASE}/api/inventory`;
const SETTINGS_API_URL = `${API_BASE}/api/settings`;
const STATUS_API_URL = `${API_BASE}/api/status`;

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// Check if backend is alive
export const checkBackendConnection = async (): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
        
        // Try a simple HEAD request or GET to inventory
        const response = await fetch(API_URL, { 
            method: 'OPTIONS', 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        return response.ok || response.status === 200 || response.status === 204;
    } catch (e) {
        return false;
    }
};

export const fetchServerInfo = async (): Promise<string | null> => {
    try {
        const response = await fetch(STATUS_API_URL);
        if (response.ok) {
            const data = await response.json();
            return `http://${data.ip}:${data.port}`;
        }
        return null;
    } catch (e) {
        return null;
    }
};

// Download full JSON backup
export const downloadBackup = (items: InventoryItem[]) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `oxitrack_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

// Download CSV Template
export const downloadTemplate = () => {
  const headers = ['入库日期', '客户名称', '产品名称', '工艺要求', '数量', '单位', '单价', '是否样板(TRUE/FALSE)', '备注'];
  const sampleRow = ['2023-10-01', '示例客户A', '铝合金外壳', '喷砂氧化黑', '100', 'pcs', '2.5', 'FALSE', '急单'];
  
  const csvContent = [
    headers.join(','),
    sampleRow.join(',')
  ].join('\n');

  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `导入模板_请按此格式整理.csv`;
  link.click();
};

// Parse JSON Backup Import
export const parseJSONImport = async (file: File): Promise<InventoryItem[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                if (Array.isArray(data)) {
                    resolve(data);
                } else {
                    reject(new Error("Invalid backup file format: Root must be an array"));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

// Helper to parse CSV (Simple implementation)
export const parseCSVImport = async (file: File): Promise<InventoryItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        // Skip header row if exists (Simple heuristic: check if first col is 'Date' or '日期')
        const startIndex = (rows[0].includes('date') || rows[0].includes('日期')) ? 1 : 0;
        
        const items: InventoryItem[] = [];
        for (let i = startIndex; i < rows.length; i++) {
          const cols = rows[i].split(',');
          if (cols.length < 4) continue;
          
          items.push({
            id: generateId(),
            date: cols[0]?.trim() || new Date().toISOString().split('T')[0],
            clientName: cols[1]?.trim() || 'Unknown',
            productName: cols[2]?.trim() || 'Unknown',
            processType: cols[3]?.trim() || 'Default',
            quantity: Number(cols[4]) || 0,
            unit: (cols[5]?.trim() as any) || 'pcs',
            pricePerUnit: Number(cols[6]) || 0,
            isSample: (cols[7]?.trim().toLowerCase() === 'true' || cols[7]?.includes('样') || cols[7]?.includes('是')),
            status: OrderStatus.INBOUND,
            notes: cols[8]?.trim() || ''
          });
        }
        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file); // Default UTF-8
  });
};

export const exportToCSV = (items: InventoryItem[], filename: string) => {
  const headers = ['入库日期', '客户', '产品', '工艺', '数量', '单位', '单价', '样板', '状态', '备注', '外发厂商', '送货单号', '送货日期', '已结账'];
  const rows = items.map(i => [
    i.date,
    i.clientName,
    i.productName,
    i.processType,
    i.quantity,
    i.unit,
    i.pricePerUnit,
    i.isSample ? '是' : '否',
    i.status,
    i.notes || '',
    i.outsourcingVendor || '',
    i.deliveryNoteId || '',
    i.deliveryDate || '',
    i.isPaid ? '是' : '否'
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

export const fetchInventory = async (): Promise<InventoryItem[]> => {
  try {
    const response = await fetch(API_URL);
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
    throw new Error('Server not responding ok');
  } catch (error) {
    console.warn("Backend unavailable, using LocalStorage for inventory");
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  }
};

export const saveInventory = async (items: InventoryItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
  } catch (error) {
    // Silent fail okay for offline
  }
};

// --- SETTINGS SERVICE ---

export const fetchSettings = async (): Promise<AppSettings> => {
    const defaultSettings: AppSettings = {
        companyName: '东东氧化加工厂',
        address: '地址：高存市本利镇金陶大道东B车间',
        phone: '电话：138-0000-0000',
        bankInfo: '开户行：XX银行  账号：6222 0000 0000 0000',
        footerNote: '注：收货时请检查货物，如对质量数量有异议，请于二十四小时内致电本厂提出，过期不受理，视为完全认同！'
    };

    try {
        const response = await fetch(SETTINGS_API_URL);
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
            return { ...defaultSettings, ...data };
        }
    } catch (error) {
        console.warn("Backend unavailable, using LocalStorage for settings");
    }

    const local = localStorage.getItem(SETTINGS_KEY);
    return local ? { ...defaultSettings, ...JSON.parse(local) } : defaultSettings;
};

export const saveSettings = async (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    try {
        await fetch(SETTINGS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
    } catch (error) {
        // Silent fail
    }
};