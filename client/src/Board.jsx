import { fmtTime } from './util.js';

const LABEL = { quiet: 'Quiet', busy: 'Filling up', packed: 'Almost full', full: 'Full' };

// The pickup board: each ten-minute slot is a departure. Pick a quiet one and you earn points.
export default function Board({ slots, rec, selected, onSelect, need }) {
  return (
    <div className="board" role="listbox" aria-label="Pickup times">
      {slots.map((s, i) => {
        const noRoom = s.free < need;
        const level = s.free <= 0 ? 'full' : s.level;
        const lit = Math.round(s.ratio * 10);
        const tags = [];
        if (rec?.fastest === s.id) tags.push(['Soonest', 't-fast']);
        if (rec?.quietest === s.id) tags.push(['Quietest', 't-quiet']);
        if (rec?.class === s.id) tags.push(['Gets you to class', 't-class']);
        if (s.eco > 0 && !noRoom) tags.push([`+${s.eco} points`, 't-pts']);
        return (
          <button key={s.id} role="option" aria-selected={selected === s.id} disabled={noRoom}
            className={`row ${level} ${selected === s.id ? 'sel' : ''}`} style={{ '--i': i }} onClick={() => onSelect(s.id)}>
            <span className="time">{fmtTime(s.start)}</span>
            <span className="meter" aria-hidden="true">{Array.from({ length: 10 }, (_, k) => <i key={k} className={k < lit ? 'on' : ''} />)}</span>
            <span className="state">{noRoom && s.free > 0 ? 'Not enough room' : LABEL[level]}</span>
            <span className="tags">{tags.map(([t, c]) => <b key={t} className={c}>{t}</b>)}</span>
          </button>
        );
      })}
    </div>
  );
}
