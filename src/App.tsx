import { useState } from 'react';
import type { Mode } from './engine/types';
import { Game } from './pages/Game';
import { Menu } from './pages/Menu';
import { hasSeat } from './online/useOnline';
import { Online } from './pages/Online';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import { Stats } from './pages/Stats';
import type { GameConfig } from './state/game';

type Route =
  | { name: 'menu' }
  | { name: 'setup'; mode: Mode }
  | { name: 'game'; config: GameConfig; key: number }
  | { name: 'online'; code?: string }
  | { name: 'stats' }
  | { name: 'settings' };

/** Resume an online seat after a reload, or open the lobby from an invite link (?room=CODE). */
function initialRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('room');
  if (code) {
    params.delete('room');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }
  if (hasSeat()) return { name: 'online' };
  return code ? { name: 'online', code } : { name: 'menu' };
}

export function App() {
  const [route, setRoute] = useState<Route>(initialRoute);
  const menu = () => setRoute({ name: 'menu' });

  let page;
  switch (route.name) {
    case 'menu':
      page = (
        <Menu
          onPlay={(mode) => setRoute({ name: 'setup', mode })}
          onOnline={() => setRoute({ name: 'online' })}
          onStats={() => setRoute({ name: 'stats' })}
          onSettings={() => setRoute({ name: 'settings' })}
        />
      );
      break;
    case 'setup':
      page = <Setup mode={route.mode} onBack={menu} onStart={(config) => setRoute({ name: 'game', config, key: Date.now() })} />;
      break;
    case 'game':
      page = <Game key={route.key} config={route.config} onMenu={menu} />;
      break;
    case 'online':
      page = <Online onBack={menu} initialCode={route.code} />;
      break;
    case 'stats':
      page = <Stats onBack={menu} />;
      break;
    case 'settings':
      page = <Settings onBack={menu} />;
      break;
  }

  return (
    <div className="app">
      <div className="page" key={route.name}>
        {page}
      </div>
    </div>
  );
}
