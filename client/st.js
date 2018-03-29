const circleCanvases = document.getElementsByClassName('circleCanvas');
// const circleButtons = document.getElementById('circleButton');

Array.prototype.forEach.call(circleCanvases, canvas => {
  const offset = canvas.getBoundingClientRect();

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const ctx = canvas.getContext('2d');
  // const t = 0;
  const delta = Math.floor(Math.sqrt(canvas.width * canvas.height) / 10);
  const max = Math.floor(Math.sqrt(Math.pow(canvas.width, 2) +
    Math.pow(canvas.height, 2)));

  canvas.onmousedown = e => {
    const evt = e;
    // console.log(`${offset.left} ${offset.top}`)
    let size = 0;
    const t = setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(0, 0, 0, ${15 * (1 / size)})`;
      ctx.beginPath();
      ctx.arc(e.clientX - offset.left, e.clientY - offset.top, size, 0, 2 * Math.PI);
      ctx.fill();
      size += delta;

      if (size > max) {
        clearInterval(t);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 20);
  };
});

// const circleDropdowns = document.getElementsByClassName('')
