// Background scenes. Each id matches css/scenes/<id>.svg and a [data-scene="<id>"] block in css/styles.css.
export const SCENES = [
  { id: 'city', name: 'City at dusk' },
  { id: 'suburb', name: 'Sunny suburb' },
  { id: 'plains', name: 'Golden plains' },
  { id: 'mountains', name: 'Misty peaks' },
  { id: 'beach', name: 'Sunny beach' },
  { id: 'waterfall', name: 'Hidden waterfall' },
  { id: 'cabin', name: 'Mountain cabin' }
];
export const sceneId = s => SCENES.some(x => x.id === s?.settings?.scene) ? s.settings.scene : 'city';
