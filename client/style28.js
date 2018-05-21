(() => {
  const btns = document.getElementsByClassName('circleButton');

  Array.prototype.forEach.call(btns, b => {
    const canv = document.createElement('canvas');
    canv.className = 'buttonCanv';
    b.appendChild(canv);
  });

  const circleCanvases = document.getElementsByClassName('buttonCanv');
  // const circleButtons = document.getElementById('circleButton');

  const fn = (canvas) => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.style.opacity = 0;
    canvas.style.backgroundColor = 'black';
    canvas.onmouseover = () => {
      canvas.style.opacity = 0.2;
    };
    canvas.onmouseout = () => {
      canvas.style.opacity = 0;
    }
  };
  Array.prototype.forEach.call(circleCanvases, fn/*canvas => {
    let offset = {};

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const ctx = canvas.getContext('2d');
    // const t = 0;
    const delta = Math.floor(Math.sqrt(canvas.width * canvas.height) / 10);
    const max = Math.floor(Math.sqrt(Math.pow(canvas.width, 2) +
      Math.pow(canvas.height, 2)));

    let t = null;
    canvas.onmousedown = (e) => {
      offset = canvas.getBoundingClientRect();
      let size = 0;
      clearInterval(t);
      t = setInterval(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = `rgba(0, 0, 0, ${5 * (1 / size)})`;
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
  }*/);
})(); 
