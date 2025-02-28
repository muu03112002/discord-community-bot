if (typeof globalThis.ReadableStream === 'undefined') {
  const { Readable } = require('stream');
  
  class ReadableStream {
    constructor(source) {
      this._source = source;
      this._readable = new Readable({
        read() {
          if (source && typeof source.pull === 'function') {
            source.pull(this);
          }
        }
      });
    }
    
    getReader() {
      return {
        read: async () => {
          return new Promise((resolve) => {
            this._readable.once('data', (chunk) => {
              resolve({ value: chunk, done: false });
            });
            
            this._readable.once('end', () => {
              resolve({ value: undefined, done: true });
            });
          });
        },
        cancel: () => {
          this._readable.destroy();
          return Promise.resolve();
        }
      };
    }
  }
  
  globalThis.ReadableStream = ReadableStream;
}

// その他の必要なグローバルWeb APIポリフィル
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}
