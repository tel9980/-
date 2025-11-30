export enum OrderStatus {
  INBOUND = 'Inbound',         // 待入库/已入库
  PROCESSING = 'Processing',   // 氧化中
  OUTSOURCED = 'Outsourced',   // 委外中
  FINISHED = 'Finished',       // 待送货
  DELIVERED = 'Delivered',     // 已送货
  RETURNED = 'Returned'        // 返工/退回
}

export const StatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.INBOUND]: '待入库',
  [OrderStatus.PROCESSING]: '氧化生产中',
  [OrderStatus.OUTSOURCED]: '委外加工中',
  [OrderStatus.FINISHED]: '待送货 (已完工)',
  [OrderStatus.DELIVERED]: '已送货',
  [OrderStatus.RETURNED]: '返工 / 退回'
};

export interface InventoryItem {
  id: string;
  date: string;          // 入库日期 YYYY-MM-DD
  clientName: string;    // 客户名称
  productName: string;   // 产品名称
  processType: string;   // 工艺/颜色
  quantity: number;      // 数量
  unit: 'pcs' | 'kg' | 'set'; // 单位
  pricePerUnit: number;  // 单价
  isSample: boolean;     // 是否样板（免费）
  status: OrderStatus;   // 状态
  notes?: string;        // 备注
  outsourcingVendor?: string; // 外发厂商
  deliveryNoteId?: string; // 关联的送货单号 (例如 NO:20231027001)
  deliveryDate?: string;   // 实际送货日期
  isPaid?: boolean;      // 是否已结账
}

export interface AppSettings {
  companyName: string;
  address: string;
  phone: string;
  bankInfo: string;
  footerNote: string;
}