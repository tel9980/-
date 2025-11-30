import React, { useState, useEffect } from 'react';
import { InventoryItem, AppSettings } from '../types';
import { Printer, Download, X } from 'lucide-react';

interface DeliveryNoteProps {
  items: InventoryItem[];
  clientName: string;
  currentSettings: AppSettings;
  onConfirmDelivery: (orderNo: string) => void;
  onClose: () => void;
  initialDate?: string;
}

interface EditableItem extends InventoryItem {
    displaySpec: string;
    displayWeight: string;
}

export const DeliveryNote: React.FC<DeliveryNoteProps> = ({ items, clientName, currentSettings, onConfirmDelivery, onClose, initialDate }) => {
  // Initialize state with props (Global Settings)
  // We use local state here so the user can modify THIS specific delivery note without changing global settings
  const [companyName, setCompanyName] = useState(currentSettings.companyName);
  const [address, setAddress] = useState(currentSettings.address);
  const [phone, setPhone] = useState(currentSettings.phone);
  const [bankInfo, setBankInfo] = useState(currentSettings.bankInfo);
  const [footerNote, setFooterNote] = useState(currentSettings.footerNote);
  
  const [orderNo, setOrderNo] = useState('');
  const [printDate, setPrintDate] = useState('');
  
  // Local Table State for Full Editing
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [isReprint, setIsReprint] = useState(false);

  useEffect(() => {
    // If initialDate is provided (reprint mode usually), use it. Otherwise use Today.
    if (initialDate) {
        setPrintDate(initialDate);
    } else {
        const today = new Date();
        setPrintDate(`${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`);
    }

    // Check if this is a Reprint (All items share the same deliveryNoteId)
    const existingIds = Array.from(new Set(items.map(i => i.deliveryNoteId).filter(Boolean)));
    
    if (existingIds.length === 1) {
        // REPRINT MODE: Use existing ID
        setOrderNo(existingIds[0] as string);
        setIsReprint(true);
    } else {
        // NEW NOTE MODE: Generate ID
        const today = new Date();
        setOrderNo(`NO:${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}${Math.floor(Math.random()*100).toString().padStart(3,'0')}`);
        setIsReprint(false);
    }
    
    // Initialize editable items
    setEditableItems(items.map(item => ({
        ...item,
        displaySpec: '',
        displayWeight: ''
    })));
  }, [items, initialDate]);

  // Calculations based on EDITABLE items
  const totalAmount = editableItems.reduce((sum, item) => {
    return sum + (item.isSample ? 0 : item.quantity * item.pricePerUnit);
  }, 0);

  const totalQty = editableItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalWeightDisplay = editableItems.reduce((sum, item) => {
      const w = parseFloat(item.displayWeight);
      return sum + (isNaN(w) ? 0 : w);
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmAndMark = () => {
      if (confirm('确定打印并标记这些订单为“已送货”吗？\n系统将保存此单号，方便日后对账。')) {
          onConfirmDelivery(orderNo);
          setTimeout(() => window.print(), 100);
      }
  };

  const handleUpdateItem = (index: number, field: keyof EditableItem, value: any) => {
      const newItems = [...editableItems];
      newItems[index] = { ...newItems[index], [field]: value };
      setEditableItems(newItems);
  };

  const handleExportExcel = () => {
    const headers = ['序号', '产品名称', '规格', '表面处理', '单位', '重量', '总数量', '单价', '金额/元', '备注'];
    const rows = editableItems.map((item, index) => [
      index + 1,
      item.productName,
      item.displaySpec, 
      item.processType,
      item.unit,
      item.displayWeight,
      item.quantity,
      item.isSample ? 0 : item.pricePerUnit,
      item.isSample ? 0 : (item.quantity * item.pricePerUnit).toFixed(2),
      (item.isSample ? '样板 ' : '') + (item.notes || '')
    ]);

    const footerRows = [
      [],
      ['合计金额', '', '', '', '', '', totalQty, '', totalAmount.toFixed(2), ''],
      [],
      ['送货方:', companyName],
      ['客户:', clientName],
      ['单号:', orderNo],
      ['日期:', printDate],
      ['地址:', address],
      ['电话:', phone],
      ['备注:', footerNote]
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ...footerRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `送货单_${clientName}_${printDate}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-800/90 z-[100] overflow-auto flex flex-col items-center animate-in fade-in duration-200">
      {/* Screen Controls (Hidden when printing) */}
      <div className="no-print w-full bg-white shadow-md p-4 sticky top-0 z-50 flex flex-col md:flex-row justify-between items-center border-b border-gray-200 gap-4">
        <div className="flex flex-col">
            <h3 className="font-bold text-slate-800 flex items-center">
                送货单预览 
                {isReprint && <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">补打模式 (单号不变)</span>}
            </h3>
            <span className="text-xs text-slate-500">提示: 点击表格中的任意内容均可修改。此页面的修改仅对本次打印有效，不会更改全局设置。</span>
        </div>
        <div className="flex flex-wrap justify-center space-x-3">
            <button onClick={onClose} className="flex items-center px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">
                <X size={18} className="mr-2" /> 关闭
            </button>
            <button onClick={handleExportExcel} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition">
                <Download size={18} className="mr-2" /> 导出 Excel
            </button>
            
            {/* Logic: If it's a reprint (already delivered), just Print. If new, show "Print & Save" */}
            {isReprint ? (
                <button onClick={handlePrint} className="flex items-center px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg shadow-md transition">
                    <Printer size={18} className="mr-2" /> 补打单据
                </button>
            ) : (
                <button onClick={handleConfirmAndMark} className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition">
                    <Printer size={18} className="mr-2" /> 确认送货并打印
                </button>
            )}
        </div>
      </div>

      {/* Printable Area - Matches Standard Chinese Delivery Note A4/Dot Matrix size */}
      <div className="bg-white shadow-2xl my-8 text-black print:shadow-none print:m-0 print:w-full print:h-auto overflow-hidden" 
           style={{ width: '210mm', minHeight: '280mm', padding: '10mm' }}>
        
        <div className="flex flex-row h-full">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col pr-4">
                
                {/* Header Section */}
                <div className="text-center relative">
                    <input 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full text-center text-4xl font-serif font-bold tracking-widest outline-none bg-transparent placeholder-gray-300 print-input"
                        placeholder="点击输入厂名"
                    />
                    <input 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full text-center text-sm mt-1 outline-none bg-transparent print-input"
                    />
                </div>

                {/* Decorative Double Line */}
                <div className="border-b-4 border-double border-black my-3"></div>

                {/* Title & Order No Row */}
                <div className="flex justify-between items-end mb-2 px-2">
                    <div className="w-1/3 text-left text-sm">
                        {/* Empty or Logo space */}
                    </div>
                    <div className="w-1/3 text-center">
                        <h2 className="text-3xl font-bold tracking-[1.5rem] whitespace-nowrap ml-6">送货单</h2>
                    </div>
                    <div className="w-1/3 text-right">
                        <span className="font-bold text-lg font-mono">
                            <input 
                                value={orderNo}
                                onChange={(e) => setOrderNo(e.target.value)}
                                className="text-right outline-none bg-transparent w-full print-input"
                            />
                        </span>
                    </div>
                </div>

                {/* Client & Date Info Row */}
                <div className="flex justify-between items-center mb-1 px-1 text-base">
                    <div className="flex items-center w-3/5">
                        <span className="font-bold whitespace-nowrap">收货单位：</span>
                        <span className="font-bold text-lg border-b border-black px-2 flex-1 text-left">{clientName}</span>
                    </div>
                    <div className="flex items-center justify-end w-2/5">
                        <span className="font-bold whitespace-nowrap">送货日期：</span>
                        <input 
                            value={printDate}
                            onChange={(e) => setPrintDate(e.target.value)}
                            className="font-bold text-lg border-b border-black px-2 w-32 text-center outline-none bg-transparent print-input"
                        />
                    </div>
                </div>

                {/* Main Data Table */}
                <table className="w-full border-collapse border border-black text-center text-sm">
                    <thead>
                        <tr className="h-10 bg-gray-50 print:bg-transparent">
                            <th className="border border-black w-10">序号</th>
                            <th className="border border-black w-auto">产品名称</th>
                            <th className="border border-black w-16">规格</th>
                            <th className="border border-black w-24">表面处理</th>
                            <th className="border border-black w-10">单位</th>
                            <th className="border border-black w-14">重量</th>
                            <th className="border border-black w-16">总数量</th>
                            <th className="border border-black w-16">单价</th>
                            <th className="border border-black w-20">金额/元</th>
                            <th className="border border-black w-20">备注</th>
                        </tr>
                    </thead>
                    <tbody>
                        {editableItems.map((item, index) => (
                            <tr key={index} className="h-10 hover:bg-blue-50/20 transition-colors">
                                <td className="border border-black">{index + 1}</td>
                                <td className="border border-black text-left px-0">
                                    <input 
                                        className="w-full h-full px-1 bg-transparent outline-none print-input font-medium"
                                        value={item.productName}
                                        onChange={(e) => handleUpdateItem(index, 'productName', e.target.value)}
                                    />
                                </td>
                                <td className="border border-black p-0">
                                  <input 
                                    className="w-full h-full text-center bg-transparent outline-none print-input" 
                                    value={item.displaySpec}
                                    onChange={(e) => handleUpdateItem(index, 'displaySpec', e.target.value)}
                                  />
                                </td>
                                <td className="border border-black p-0">
                                    <input 
                                        className="w-full h-full text-center bg-transparent outline-none print-input"
                                        value={item.processType}
                                        onChange={(e) => handleUpdateItem(index, 'processType', e.target.value)}
                                    />
                                </td>
                                <td className="border border-black p-0">
                                    <input 
                                        className="w-full h-full text-center bg-transparent outline-none print-input"
                                        value={item.unit}
                                        onChange={(e) => handleUpdateItem(index, 'unit', e.target.value)}
                                    />
                                </td>
                                <td className="border border-black p-0">
                                  <input 
                                    className="w-full h-full text-center bg-transparent outline-none print-input" 
                                    value={item.displayWeight}
                                    onChange={(e) => handleUpdateItem(index, 'displayWeight', e.target.value)}
                                  />
                                </td>
                                <td className="border border-black font-bold text-base p-0">
                                    <input 
                                        type="number"
                                        className="w-full h-full text-center bg-transparent outline-none print-input"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItem(index, 'quantity', Number(e.target.value))}
                                    />
                                </td>
                                <td className="border border-black p-0">
                                    {item.isSample ? (
                                        <span className="text-gray-400">-</span>
                                    ) : (
                                        <input 
                                            type="number"
                                            step="0.01"
                                            className="w-full h-full text-center bg-transparent outline-none print-input"
                                            value={item.pricePerUnit}
                                            onChange={(e) => handleUpdateItem(index, 'pricePerUnit', Number(e.target.value))}
                                        />
                                    )}
                                </td>
                                <td className="border border-black font-medium">
                                    {item.isSample ? '0' : (item.quantity * item.pricePerUnit).toFixed(2)}
                                </td>
                                <td className="border border-black p-0">
                                    <input 
                                        className="w-full h-full text-center text-xs bg-transparent outline-none print-input"
                                        value={item.notes || ''}
                                        onChange={(e) => handleUpdateItem(index, 'notes', e.target.value)}
                                        placeholder={item.isSample ? '样板' : ''}
                                    />
                                </td>
                            </tr>
                        ))}
                        {/* Auto-fill empty rows */}
                        {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                            <tr key={`empty-${i}`} className="h-10">
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                        {/* Total Row */}
                        <tr className="h-10 font-bold">
                            <td colSpan={5} className="border border-black text-right pr-4 text-base">合计:</td>
                            <td className="border border-black text-center text-sm font-normal">{totalWeightDisplay > 0 ? totalWeightDisplay : ''}</td>
                            <td className="border border-black text-center text-lg">{totalQty}</td>
                            <td className="border border-black"></td>
                            <td className="border border-black text-lg">{totalAmount.toFixed(2)}</td>
                            <td className="border border-black"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Footer Notes */}
                <div className="mt-1 text-sm">
                     <textarea 
                        value={footerNote}
                        onChange={(e) => setFooterNote(e.target.value)}
                        className="w-full h-10 outline-none bg-transparent resize-none overflow-hidden pt-1 print-input"
                     />
                </div>

                {/* Signature Section */}
                <div className="mt-4 flex justify-between items-end text-base px-2">
                    <div className="w-1/3">
                        <span className="font-bold">收货单位及经手人：</span>
                    </div>
                    <div className="w-1/3 text-center">
                        <span className="font-bold">制单人：</span>
                        <span className="ml-2 font-handwriting">管理员</span>
                    </div>
                    <div className="w-1/3 text-right">
                         <span className="font-bold">送货人：</span>
                    </div>
                </div>

                {/* Bottom Contact & Bank Info */}
                <div className="mt-6 border-t border-black pt-2 text-sm flex items-center justify-center">
                    <input 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-40 outline-none bg-transparent text-center font-bold print-input"
                    />
                    <span className="mx-2 text-gray-400">|</span>
                     <input 
                        value={bankInfo}
                        onChange={(e) => setBankInfo(e.target.value)}
                        className="flex-1 outline-none bg-transparent text-center print-input"
                    />
                </div>
            </div>

            {/* Right Sidebar - Vertical Text Strip */}
            <div className="w-10 ml-1 border-l-2 border-dashed border-gray-400 flex flex-col justify-between items-center py-10 text-sm text-gray-600 font-medium select-none print:text-black h-[280mm]">
                 {/* This section mimics the tear-off side strip of a multi-part form */}
                <div className="flex flex-col space-y-20 pt-10">
                    <div className="writing-vertical-rl tracking-widest text-xs">① 第一联 存根 (白)</div>
                    <div className="writing-vertical-rl tracking-widest text-xs">② 第二联 客户 (红)</div>
                    <div className="writing-vertical-rl tracking-widest text-xs">③ 第三联 财务 (黄)</div>
                    <div className="writing-vertical-rl tracking-widest text-xs">④ 第四联 回单 (蓝)</div>
                </div>
            </div>
        </div>

        {/* CSS for print-specific styling */}
        <style>{`
            .writing-vertical-rl {
                writing-mode: vertical-rl;
                text-orientation: mixed;
            }
            .print-input {
                border: none;
                background: transparent;
            }
            @media print {
                @page { 
                    size: A4; 
                    margin: 0; 
                }
                body { 
                    -webkit-print-color-adjust: exact; 
                    background-color: white;
                }
                .no-print { display: none !important; }
                input, textarea {
                    border: none !important;
                    background: transparent !important;
                    outline: none !important;
                    resize: none !important;
                }
            }
        `}</style>
      </div>
    </div>
  );
};