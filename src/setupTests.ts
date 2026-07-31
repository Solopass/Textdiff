import '@testing-library/jest-dom';

class Worker {
  url: string;
  onmessage: (msg: any) => void;
  constructor(stringUrl: string) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }
  postMessage(msg: any) {
    // Mock the postMessage to just return an empty response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { type: 'RESULT', payload: [] } });
      }
    }, 10);
  }
  terminate() {}
}
(window as any).Worker = Worker;

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(window as any).ResizeObserver = ResizeObserver;
