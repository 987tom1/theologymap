// engine/storage-local.js — the local (offline) storage adapter for editor.html.
//
// Lifted verbatim from editor.html's inline IIFE (phase 1c, docs/hosting/phase-1-design.md
// §7): the File System Access API, the fileInput fallback, and the local render server
// call. Behaviour and status wording are unchanged from before the extraction.
//
// Adapter interface (shared with engine/storage-hosted.js — see editor.html):
//   { mode, supportsAutosave, async init(ui), async load(), async save(text, token, force),
//     async render(text), buttons: {connect, upload, save, render} }
// `ui` is { elements: {btnConnect, btnUpload, fileInput}, onLoaded(text, label, writable), setStatus(msg, kind) }.

window.StorageLocal = function () {
  let fileHandle = null; // FileSystemFileHandle, when connected

  return {
    mode: 'local',
    supportsAutosave: false,

    async init(ui) {
      const { elements, onLoaded, setStatus } = ui;
      const { btnConnect, btnUpload, fileInput } = elements;

      const canFSAccess = 'showOpenFilePicker' in window;
      if (!canFSAccess) {
        btnConnect.disabled = true;
        btnConnect.title = 'This browser doesn\'t support direct file access — use "Upload a copy instead".';
      }

      btnConnect.addEventListener('click', async () => {
        try {
          const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
            excludeAcceptAllOption: false,
          });
          const file = await handle.getFile();
          const text = await file.text();
          fileHandle = handle;
          onLoaded(text, file.name, true);
        } catch (err) {
          if (err.name !== 'AbortError') setStatus('Could not open file: ' + err.message, 'err');
        }
      });

      btnUpload.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        const text = await file.text();
        fileHandle = null;
        onLoaded(text, file.name, false);
      });
    },

    async save(text) {
      if (!fileHandle) throw new Error('No file connected — use "Connect theology-map.md" first.');
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      return { token: undefined };
    },

    async render(text) {
      if (!fileHandle) throw new Error('No file connected — use "Connect theology-map.md" first.');
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();

      let resp;
      try {
        resp = await fetch('http://localhost:8420/api/render', { method: 'POST' });
      } catch {
        throw new Error('Could not reach the render server. Double-click start_editor.bat, or run: python engine/render_server.py');
      }
      const data = await resp.json();
      if (!data.ok) {
        console.error(data.output);
        throw new Error('render.py reported a problem — see console.');
      }
    },

    buttons: { connect: true, upload: true, save: true, render: true },
  };
};
