/* 박물관 뷰어 공용 WebGL·행렬 도구. */
(function(global){
  'use strict';
  function loop(fn) {
    let last = performance.now(), acc = 0, n = 0, ms = 0;
    function step(now) {
      const dt = now - last;
      last = now;
      acc += dt; n++;
      if (n >= 30) { ms = acc / n; acc = 0; n = 0; }
      fn(now * 0.001, dt * 0.001, ms);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function shader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error(log);
    }
    return s;
  }

  function program(gl, vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      throw new Error(log);
    }
    return p;
  }

  // 이름 -> uniform location 을 미리 찾아 둔다
  function uniforms(gl, prog, names) {
    const u = {};
    names.forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    return u;
  }

  function upload(gl, m) {
    const vao = gl.createVertexArray();
    const buffers = [];
    gl.bindVertexArray(vao);
    [['pos', 3, 0], ['nrm', 3, 1], ['uv', 2, 2], ['col', 3, 3]].forEach(function (a) {
      if (!m[a[0]]) return;
      const b = gl.createBuffer();
      buffers.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, m[a[0]], gl.STATIC_DRAW);
      gl.enableVertexAttribArray(a[2]);
      gl.vertexAttribPointer(a[2], a[1], gl.FLOAT, false, 0, 0);
    });
    const ib = gl.createBuffer();
    buffers.push(ib);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao: vao, count: m.idx.length, verts: m.pos.length / 3,
      dispose: function () { buffers.forEach(b=>gl.deleteBuffer(b)); gl.deleteVertexArray(vao); } };
  }

  const M4 = {
    create: function () {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    identity: function (o) {
      o.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); return o;
    },
    multiply: function (o, a, b) {
      const r = new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let row = 0; row < 4; row++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
          r[c * 4 + row] = s;
        }
      }
      o.set(r); return o;
    },
    translate: function (o, a, v) {
      const t = M4.identity(M4.create());
      t[12] = v[0]; t[13] = v[1]; t[14] = v[2];
      return M4.multiply(o, a, t);
    },
    scale: function (o, a, v) {
      const t = M4.identity(M4.create());
      t[0] = v[0]; t[5] = v[1]; t[10] = v[2];
      return M4.multiply(o, a, t);
    },
    rotateY: function (o, a, r) {
      const t = M4.identity(M4.create()), c = Math.cos(r), s = Math.sin(r);
      t[0] = c; t[2] = -s; t[8] = s; t[10] = c;
      return M4.multiply(o, a, t);
    },
    perspective: function (o, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o.set([f / aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
      return o;
    },
    ortho: function (o, l, r, b, t, n, f) {
      o.set([2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,-2/(f-n),0,
             -(r+l)/(r-l), -(t+b)/(t-b), -(f+n)/(f-n), 1]);
      return o;
    },
    lookAt: function (o, eye, center, up) {
      let zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
      let zl = Math.hypot(zx, zy, zz) || 1; zx/=zl; zy/=zl; zz/=zl;
      let xx = up[1]*zz - up[2]*zy, xy = up[2]*zx - up[0]*zz, xz = up[0]*zy - up[1]*zx;
      let xl = Math.hypot(xx, xy, xz) || 1; xx/=xl; xy/=xl; xz/=xl;
      const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
      o.set([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
             -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
             -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
             -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1]);
      return o;
    },
    // 법선 행렬 = transpose(inverse(model)) 의 좌상단 3x3
    normalFrom: function (m) {
      const a00=m[0],a01=m[1],a02=m[2], a10=m[4],a11=m[5],a12=m[6], a20=m[8],a21=m[9],a22=m[10];
      const b01= a22*a11 - a12*a21, b11=-a22*a10 + a12*a20, b21= a21*a10 - a11*a20;
      let det = a00*b01 + a01*b11 + a02*b21;
      if (!det) return new Float32Array([1,0,0, 0,1,0, 0,0,1]);
      det = 1 / det;
      return new Float32Array([
        b01*det, (-a22*a01 + a02*a21)*det, ( a12*a01 - a02*a11)*det,
        b11*det, ( a22*a00 - a02*a20)*det, (-a12*a00 + a02*a10)*det,
        b21*det, (-a21*a00 + a01*a20)*det, ( a11*a00 - a01*a10)*det,
      ]);
    },
  };

  global.D={loop,program,uniforms,upload,M4};
})(window);
