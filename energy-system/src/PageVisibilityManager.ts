// 页面可见性管理器
export class PageVisibilityManager {
  private isVisible = true;
  private callbacks: Array<(visible: boolean) => void> = [];

  constructor() {
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      this.notifyCallbacks();
    });

    // 监听窗口焦点变化
    window.addEventListener('focus', () => {
      this.isVisible = true;
      this.notifyCallbacks();
    });

    window.addEventListener('blur', () => {
      this.isVisible = false;
      this.notifyCallbacks();
    });
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.isVisible));
  }

  // 添加可见性变化监听器
  onVisibilityChange(callback: (visible: boolean) => void) {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  // 获取当前可见性状态
  getVisibility(): boolean {
    return this.isVisible;
  }

  // 显示警告信息
  showBackgroundWarning() {
    if (!this.isVisible) {
      console.warn('⚠️ 页面已切换到后台，计算可能会暂停。建议保持页面活跃状态。');
      
      // 可以显示一个提示框
      if (confirm('页面已切换到后台，优化计算可能会暂停。\n\n点击"确定"返回页面继续计算，或"取消"在后台继续（可能较慢）。')) {
        window.focus();
      }
    }
  }
}

export const pageVisibilityManager = new PageVisibilityManager();