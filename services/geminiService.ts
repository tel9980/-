import { GoogleGenAI } from "@google/genai";
import { InventoryItem } from "../types";

// Safety check for API key in browser environment
// In a pure static deployment without bundler, process might not be defined.
const API_KEY = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';

export const analyzePlantStatus = async (items: InventoryItem[]): Promise<string> => {
  if (!API_KEY) {
    return "提示：未检测到 API Key。如需使用 AI 分析功能，请在部署环境中配置 process.env.API_KEY，或联系管理员。";
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Prepare a lightweight summary to avoid token limits
  const summaryData = items.slice(0, 50).map(i => ({
    client: i.clientName,
    product: i.productName,
    status: i.status,
    isSample: i.isSample,
    qty: i.quantity,
    vendor: i.outsourcingVendor
  }));

  const prompt = `
    你是一个氧化厂的生产经理助理。请根据以下最近的订单数据（JSON格式）进行分析：
    ${JSON.stringify(summaryData)}

    请提供一份简短专业的中文分析报告（不超过3句话），重点关注：
    1. 哪些客户最近订单最多？
    2. 是否有大量外发（Outsourced）订单未回厂？
    3. 生产线上是否有堆积（Processing）？
    
    请用鼓励和专业的语气给出一条管理建议。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "无法生成分析报告。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI 助手连接失败，请检查网络设置。";
  }
};