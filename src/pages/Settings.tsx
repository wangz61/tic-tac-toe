import { Piece } from '../components/Piece';
import { Segmented, Toggle, TopBar } from '../components/ui';
import { useSound } from '../hooks/useSound';
import { DEFAULT_SETTINGS, useStore, type Motion, type PieceStyle, type Theme } from '../state/AppStore';

export function Settings({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const play = useSound();

  return (
    <main className="page-narrow">
      <TopBar title="Settings" onBack={onBack} />
      <div className="card setup">
        <Segmented<Theme>
          label="Theme"
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />

        <Segmented<PieceStyle>
          label="Pieces"
          options={[
            { value: 'classic', label: 'Classic' },
            { value: 'bold', label: 'Bold' },
          ]}
          value={settings.pieceStyle}
          onChange={(pieceStyle) => updateSettings({ pieceStyle })}
        />
        <div className={`piece-preview board--${settings.pieceStyle}`} aria-hidden="true">
          <Piece key={`x-${settings.pieceStyle}`} player="X" />
          <Piece key={`o-${settings.pieceStyle}`} player="O" />
        </div>

        <Segmented<Motion>
          label="Animations"
          options={[
            { value: 'full', label: 'Full' },
            { value: 'reduced', label: 'Reduced' },
          ]}
          value={settings.motion}
          onChange={(motion) => updateSettings({ motion })}
        />

        <Toggle label="Sound effects" checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
        <div className="field">
          <label className="field__label" htmlFor="volume">
            Volume <span className="muted">{Math.round(settings.volume * 100)}%</span>
          </label>
          <input
            id="volume"
            type="range"
            className="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            disabled={!settings.sound}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            onPointerUp={() => play('placeX')}
            onKeyUp={() => play('placeX')}
          />
        </div>

        <Toggle
          label="Show hints"
          hint="Shows whether each empty cell leads to a win, draw or loss."
          checked={settings.hints}
          onChange={(hints) => updateSettings({ hints })}
        />

        <button type="button" className="btn btn--ghost" onClick={() => updateSettings(DEFAULT_SETTINGS)}>
          Reset to defaults
        </button>
      </div>
    </main>
  );
}
