export default {
  mounted(el, binding) {
    const duration = binding.arg || 600;
    let timer = null;

    const start = (event) => {
      if ((event.type === 'mousedown' || event.type === 'touchstart') && event?.button != 2) {
        timer = setTimeout(() => {
          event.preventDefault();
          binding.value(event);
        }, duration);
      }
    };

    const cancel = (event) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const preventContextMenu = (event) => {
      event.preventDefault();
			binding.value(event);
    };
		
    el._start = start;
    el._cancel = cancel;
    el._preventContextMenu = preventContextMenu;

    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseout', cancel);
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
		el.addEventListener('contextmenu', preventContextMenu);
  },

  unmounted(el) {
    el.removeEventListener('mousedown', el._start);
    el.removeEventListener('touchstart', el._start);
    el.removeEventListener('mouseup', el._cancel);
    el.removeEventListener('mouseout', el._cancel);
    el.removeEventListener('touchend', el._cancel);
    el.removeEventListener('touchcancel', el._cancel);

    delete el._start;
    delete el._cancel;
  }
};