let title = process.title;
Object.defineProperty(process, 'title', { configurable: true, get: () => title, set: (value) => { title = String(value); } });
