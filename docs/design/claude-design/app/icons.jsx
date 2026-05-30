/* global React */
// CV-Adapter icon set — lucide-style stroke icons
const _ico = {
  user: 'M20 21a8 8 0 1 0-16 0 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  file: 'M14 3v5h5 M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M9 13h6 M9 17h4',
  files: 'M5 7v12a2 2 0 0 0 2 2h10 M9 3h6l4 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M15 3v4h4',
  sun: 'M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'M18 6 6 18 M6 6l12 12',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M3 6h18 M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6',
  up: 'M12 19V5 M5 12l7-7 7 7',
  down: 'M12 5v14 M19 12l-7 7-7-7',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  copy: 'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z M5 15V5a2 2 0 0 1 2-2h8',
  check: 'M20 6 9 17l-5-5',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M5.6 5.6l2.8 2.8 M15.6 15.6l2.8 2.8 M18.4 5.6l-2.8 2.8 M8.4 15.6l-2.8 2.8',
  ext: 'M15 3h6v6 M10 14 21 3 M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
  arrow: 'M5 12h14 M12 5l7 7-7 7',
  retry: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  dots: 'M12 5h.01 M12 12h.01 M12 19h.01',
  home: 'M3 10.5 12 3l9 7.5 M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5',
  briefcase: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18',
  cap: 'M22 10 12 5 2 10l10 5 10-5z M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5',
  chip: 'M9 2v3 M15 2v3 M9 19v3 M15 19v3 M2 9h3 M2 15h3 M19 9h3 M19 15h3 M5 5h14v14H5z M9 9h6v6H9z',
  folder: 'M4 5h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M8.2 13.8 7 22l5-3 5 3-1.2-8.2',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 7v5l3 2',
};
function Icon({name, size, stroke}){
  const d = _ico[name] || '';
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke||2} strokeLinecap="round" strokeLinejoin="round"
      width={size||undefined} height={size||undefined} aria-hidden="true"
      style={size?{width:size,height:size}:undefined}>
      {d.split(' M').map((seg,i)=> <path key={i} d={(i?'M':'')+seg}/>)}
    </svg>
  );
}
window.Icon = Icon;
