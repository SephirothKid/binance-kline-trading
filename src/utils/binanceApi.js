import axios from 'axios';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';

/**
 * 币安API封装
 */
class BinanceAPI {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
  }

  /**
   * 获取历史K线数据
   * @param {string} symbol - 交易对，如 'BTCUSDT'
   * @param {string} interval - 时间间隔，如 '1m', '5m', '1h', '1d'
   * @param {number} limit - 数据条数，默认500
   */
  async getKlines(symbol = 'BTCUSDT', interval = '1m', limit = 500) {
    try {
      const response = await axios.get(`${BINANCE_API_BASE}/klines`, {
        params: {
          symbol: symbol.toUpperCase(),
          interval,
          limit
        }
      });
      
      return response.data.map(kline => ({
        time: kline[0] / 1000, // 转换为秒
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      }));
    } catch (error) {
      console.error('获取K线数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取24小时价格统计
   */
  async get24hrStats(symbol = 'BTCUSDT') {
    try {
      const response = await axios.get(`${BINANCE_API_BASE}/ticker/24hr`, {
        params: { symbol: symbol.toUpperCase() }
      });
      
      return {
        symbol: response.data.symbol,
        priceChange: parseFloat(response.data.priceChange),
        priceChangePercent: parseFloat(response.data.priceChangePercent),
        lastPrice: parseFloat(response.data.lastPrice),
        volume: parseFloat(response.data.volume),
        quoteVolume: parseFloat(response.data.quoteVolume),
        highPrice: parseFloat(response.data.highPrice),
        lowPrice: parseFloat(response.data.lowPrice)
      };
    } catch (error) {
      console.error('获取24小时统计失败:', error);
      throw error;
    }
  }

  /**
   * 订阅实时K线数据
   */
  subscribeKline(symbol = 'BTCUSDT', interval = '1m', callback) {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.ws = new WebSocket(`${BINANCE_WS_BASE}/${stream}`);
      
      this.ws.onopen = () => {
        console.log('WebSocket连接已建立');
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.k) {
          const kline = {
            time: data.k.t / 1000,
            open: parseFloat(data.k.o),
            high: parseFloat(data.k.h),
            low: parseFloat(data.k.l),
            close: parseFloat(data.k.c),
            volume: parseFloat(data.k.v),
            isFinal: data.k.x // 是否为最终数据
          };
          
          // 通知所有订阅者
          this.subscribers.forEach(cb => cb(kline));
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        // 自动重连
        setTimeout(() => {
          if (this.subscribers.size > 0) {
            this.subscribeKline(symbol, interval, callback);
          }
        }, 3000);
      };
    }
    
    this.subscribers.set(callback, callback);
  }

  /**
   * 取消订阅
   */
  unsubscribe(callback) {
    this.subscribers.delete(callback);
    
    if (this.subscribers.size === 0 && this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll() {
    this.subscribers.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new BinanceAPI();
