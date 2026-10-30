// Desktop shell: loads the static Vite build in a locked-down window.
const { app, BrowserWindow, Menu, nativeTheme, shell } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: 'Tic-Tac-Toe',
    icon: path.join(__dirname, 'icon.png'),
    // Match the page background so there is no white flash on launch.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#12141c' : '#f4f5f9',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // The game never navigates; open any external link in the default browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

Menu.setApplicationMenu(null);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());
