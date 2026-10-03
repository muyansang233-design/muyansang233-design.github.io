(() => {
  const frame = document.getElementById('tree-scene-frame');
  if (!frame) return;

  const axes = ['x', 'y', 'z'];
  const sliders = Object.fromEntries(axes.map(axis => [axis, document.getElementById(`tree-wind-${axis}`)]));
  const strength = document.getElementById('tree-wind-strength');
  const regenerate = document.getElementById('tree-regenerate');
  const toggle = document.getElementById('tree-wind-toggle');
  let windVisible = false;
  const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;

  function send(action, values = {}) {
    frame.contentWindow?.postMessage({ channel: 'jacky-tree', action, ...values }, targetOrigin);
  }

  function showValue(input) {
    const output = document.getElementById(`${input.id}-value`);
    if (output) output.value = Number(input.value).toFixed(2);
  }

  function sendWind() {
    send('wind', {
      x: Number(sliders.x.value),
      y: Number(sliders.y.value),
      z: Number(sliders.z.value),
      strength: Number(strength.value)
    });
  }

  [...axes.map(axis => sliders[axis]), strength].forEach(input => {
    input.addEventListener('input', () => {
      showValue(input);
      sendWind();
    });
  });

  regenerate.addEventListener('click', () => send('regenerate'));
  toggle.addEventListener('click', () => {
    windVisible = !windVisible;
    toggle.setAttribute('aria-pressed', String(windVisible));
    toggle.textContent = windVisible ? 'Hide wind vectors' : 'Show wind vectors';
    send('wind-visual', { visible: windVisible });
  });

  function syncControls() {
    sendWind();
    send('wind-visual', { visible: windVisible });
  }

  frame.addEventListener('load', syncControls);
  window.addEventListener('message', event => {
    if (event.source === frame.contentWindow && event.data?.channel === 'jacky-tree' && event.data.action === 'ready') {
      syncControls();
    }
  });
})();
