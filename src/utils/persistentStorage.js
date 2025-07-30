/**
 * 持久化存储工具
 * 优先使用IndexedDB，降级到localStorage
 */

class PersistentStorage {
  constructor() {
    this.dbName = 'KlineDataDB'
    this.dbVersion = 1
    this.storeName = 'cache'
    this.db = null
    this.isIndexedDBSupported = this.checkIndexedDBSupport()
  }

  /**
   * 检查IndexedDB支持
   */
  checkIndexedDBSupport() {
    return 'indexedDB' in window && window.indexedDB !== null
  }

  /**
   * 初始化IndexedDB
   */
  async initIndexedDB() {
    if (!this.isIndexedDBSupported) {
      console.log('📦 IndexedDB不支持，使用localStorage')
      return false
    }

    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion)

        request.onerror = () => {
          console.warn('⚠️ IndexedDB打开失败，降级到localStorage')
          resolve(false)
        }

        request.onsuccess = (event) => {
          this.db = event.target.result
          console.log('✅ IndexedDB初始化成功')
          resolve(true)
        }

        request.onupgradeneeded = (event) => {
          const db = event.target.result
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'key' })
            store.createIndex('timestamp', 'timestamp', { unique: false })
          }
        }
      })
    } catch (error) {
      console.warn('⚠️ IndexedDB初始化失败:', error)
      return false
    }
  }

  /**
   * 保存数据到IndexedDB
   */
  async saveToIndexedDB(key, data) {
    if (!this.db) return false

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        
        const request = store.put({
          key,
          data: data.data,
          timestamp: data.timestamp
        })

        request.onsuccess = () => resolve(true)
        request.onerror = () => resolve(false)
      })
    } catch (error) {
      console.warn('⚠️ IndexedDB保存失败:', error)
      return false
    }
  }

  /**
   * 从IndexedDB读取数据
   */
  async getFromIndexedDB(key) {
    if (!this.db) return null

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.get(key)

        request.onsuccess = (event) => {
          const result = event.target.result
          if (result) {
            resolve({
              data: result.data,
              timestamp: result.timestamp
            })
          } else {
            resolve(null)
          }
        }

        request.onerror = () => resolve(null)
      })
    } catch (error) {
      console.warn('⚠️ IndexedDB读取失败:', error)
      return null
    }
  }

  /**
   * 从IndexedDB获取所有数据
   */
  async getAllFromIndexedDB() {
    if (!this.db) return {}

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.getAll()

        request.onsuccess = (event) => {
          const results = event.target.result
          const data = {}
          results.forEach(item => {
            data[item.key] = {
              data: item.data,
              timestamp: item.timestamp
            }
          })
          resolve(data)
        }

        request.onerror = () => resolve({})
      })
    } catch (error) {
      console.warn('⚠️ IndexedDB读取所有数据失败:', error)
      return {}
    }
  }

  /**
   * 清理IndexedDB
   */
  async clearIndexedDB() {
    if (!this.db) return

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.clear()

        request.onsuccess = () => resolve(true)
        request.onerror = () => resolve(false)
      })
    } catch (error) {
      console.warn('⚠️ IndexedDB清理失败:', error)
      return false
    }
  }

  /**
   * 保存数据（自动选择存储方式）
   */
  async save(key, data) {
    // 优先使用IndexedDB
    if (this.db) {
      const success = await this.saveToIndexedDB(key, data)
      if (success) return true
    }

    // 降级到localStorage
    try {
      const allData = JSON.parse(localStorage.getItem('kline_cache') || '{}')
      allData[key] = data
      localStorage.setItem('kline_cache', JSON.stringify(allData))
      return true
    } catch (error) {
      console.warn('⚠️ localStorage保存失败:', error)
      return false
    }
  }

  /**
   * 读取数据（自动选择存储方式）
   */
  async get(key) {
    // 优先使用IndexedDB
    if (this.db) {
      const data = await this.getFromIndexedDB(key)
      if (data) return data
    }

    // 降级到localStorage
    try {
      const allData = JSON.parse(localStorage.getItem('kline_cache') || '{}')
      return allData[key] || null
    } catch (error) {
      console.warn('⚠️ localStorage读取失败:', error)
      return null
    }
  }

  /**
   * 获取所有数据
   */
  async getAll() {
    // 优先使用IndexedDB
    if (this.db) {
      return await this.getAllFromIndexedDB()
    }

    // 降级到localStorage
    try {
      return JSON.parse(localStorage.getItem('kline_cache') || '{}')
    } catch (error) {
      console.warn('⚠️ localStorage读取所有数据失败:', error)
      return {}
    }
  }

  /**
   * 清理所有数据
   */
  async clear() {
    // 清理IndexedDB
    if (this.db) {
      await this.clearIndexedDB()
    }

    // 清理localStorage
    try {
      localStorage.removeItem('kline_cache')
    } catch (error) {
      console.warn('⚠️ localStorage清理失败:', error)
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStats() {
    const allData = await this.getAll()
    const keys = Object.keys(allData)
    
    return {
      storageType: this.db ? 'IndexedDB' : 'localStorage',
      itemCount: keys.length,
      keys: keys,
      estimatedSize: this.estimateSize(allData)
    }
  }

  /**
   * 估算数据大小
   */
  estimateSize(data) {
    try {
      const jsonString = JSON.stringify(data)
      return `${(jsonString.length / 1024).toFixed(2)} KB`
    } catch (error) {
      return 'Unknown'
    }
  }
}

// 创建单例
const persistentStorage = new PersistentStorage()

// 初始化
persistentStorage.initIndexedDB().then(success => {
  if (success) {
    console.log('🚀 持久化存储初始化完成 (IndexedDB)')
  } else {
    console.log('🚀 持久化存储初始化完成 (localStorage)')
  }
})

export default persistentStorage
