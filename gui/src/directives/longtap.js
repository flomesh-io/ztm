export default {
  mounted(el, binding) {
    const duration = binding.arg || 800;
    let timer = null;
    const start = (event) => {
      if (event.type === 'mousedown' || event.type === 'touchstart') {
        timer = setTimeout(() => {
					event.preventDefault();
          binding.value(event);
        }, duration);
      }
    };

    // 清除定时器的函数
    const cancel = (event) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      };
    };

    el._start = start;
    el._cancel = cancel;

    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseout', cancel);
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
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