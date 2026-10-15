/* Espacios del recorrido. Las fotos están en img/pano/<id>.jpg (3840×1920)
   y las miniaturas en img/thumb/<id>.jpg (320×160). */
/* dye: color del fieltro de cada zona. El girasol se reserva para el espacio activo. */
window.ACO_CATEGORIES = {
  'Accesos y exteriores': { key: 'exteriores', short: 'Exteriores', chip: 'Exteriores', dye: 'azul' },
  'Zonas comunes': { key: 'comunes', short: 'Zonas comunes', chip: 'Comunes', dye: 'blanco' },
  'Aulas': { key: 'aulas', short: 'Aulas', chip: 'Aulas', dye: 'violeta' }
};

window.ACO_ROOMS = [
  { id: 'entrada', number: 1, name: 'Entrada principal', category: 'Accesos y exteriores' },
  { id: 'principal', number: 2, name: 'Zona principal', category: 'Accesos y exteriores' },
  { id: 'cancha', number: 3, name: 'Cancha', category: 'Accesos y exteriores' },
  { id: 'patio', number: 4, name: 'Patio', category: 'Accesos y exteriores' },
  { id: 'pasillo', number: 5, name: 'Pasillo principal', category: 'Accesos y exteriores' },
  { id: 'segundo-piso', number: 6, name: 'Segundo piso', category: 'Accesos y exteriores' },
  { id: 'cafeteria', number: 7, name: 'Cafetería', category: 'Zonas comunes' },
  { id: 'biblioteca', number: 8, name: 'Biblioteca', category: 'Zonas comunes' },
  { id: 'audiovisuales', number: 9, name: 'Audiovisuales', category: 'Zonas comunes' },
  { id: 'laboratorio', number: 10, name: 'Laboratorio', category: 'Zonas comunes' },
  { id: 'salon-1-2', number: 11, name: 'Salón 1 y 2', category: 'Aulas' },
  { id: 'salon-5', number: 12, name: 'Salón 5', category: 'Aulas' },
  { id: 'salon-6', number: 13, name: 'Salón 6', category: 'Aulas' },
  { id: 'salon-7', number: 14, name: 'Salón 7', category: 'Aulas' },
  { id: 'salon-8', number: 15, name: 'Salón 8', category: 'Aulas' },
  { id: 'salon-9', number: 16, name: 'Salón 9', category: 'Aulas' },
  { id: 'salon-10', number: 17, name: 'Salón 10', category: 'Aulas' },
  { id: 'salon-11a', number: 18, name: 'Salón 11A', category: 'Aulas' },
  { id: 'salon-11b', number: 19, name: 'Salón 11B', category: 'Aulas' },
  { id: 'informatica', number: 20, name: 'Sala de informática técnica', category: 'Aulas' },
  { id: 'primaria', number: 21, name: 'Salón de primaria', category: 'Aulas' },
  { id: 'profesores', number: 22, name: 'Sala de profesores', category: 'Zonas comunes' }
];
