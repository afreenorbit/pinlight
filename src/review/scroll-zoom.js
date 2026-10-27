// The page should scroll when the wheel passes over a 3D view. Zooming with the wheel turns on
// once the person clicks into the view and turns off again when the pointer leaves it.
export function zoomAfterClick(controls, element) {
  controls.enableZoom = false;
  const on = () => { controls.enableZoom = true; }, off = () => { controls.enableZoom = false; };
  element.addEventListener('pointerdown', on);
  element.addEventListener('pointerleave', off);
  return () => { element.removeEventListener('pointerdown', on); element.removeEventListener('pointerleave', off); };
}
