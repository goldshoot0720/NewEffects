/* 透明人物圖的網格舞動：保留原畫，分別擺動手臂、膝腿與頭髮。 */
(() => {
  'use strict';
  const sheet = new Image();
  const status = document.getElementById('danceStatus');
  const surface = document.createElement('canvas');
  const gl = surface.getContext('webgl', {alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true});
  const actors = [];
  const api = window.SpriteDancers = {ready: false, error: null, draw};
  // 每個區域包含完整人物；嘴部以原圖座標定位。
  const regions = [
    {box: [132, 0, 406, 524], mouth: [345, 110]},
    {box: [558, 0, 430, 524], mouth: [762, 106]},
    {box: [1028, 0, 430, 524], mouth: [1207, 99]},
    {box: [100, 524, 440, 500], mouth: [317, 609]},
    {box: [552, 524, 437, 500], mouth: [760, 605]},
    {box: [1028, 524, 435, 500], mouth: [1220, 612]}
  ];
  function fail(message){
    api.error = message;
    if(status) status.textContent = '人物素材無法載入，使用 Q 版舞者';
    console.warn(message);
  }
  if(!gl){ fail('此瀏覽器無法建立人物動畫 WebGL 畫布'); return; }

  function shader(type, source){
    const s = gl.createShader(type);
    gl.shaderSource(s, source); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let program, uvLoc, waveLoc, energyLoc, squashLoc, centerLoc;
  try{
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec2 uv;
      varying vec2 texcoord;
      uniform float wave, energy, squash, center;
      void main(){
        vec2 p = uv;
        float side = uv.x < center ? -1.0 : 1.0;
        // 手臂的權重在肩膀為零，在手掌達到一；頭部不受影響。
        float arm = smoothstep(.16, .38, abs(uv.x-center))
          * smoothstep(.23, .38, uv.y) * (1.0-smoothstep(.52,.65,uv.y));
        vec2 shoulder = vec2(center+side*.16,.31);
        vec2 d = uv-shoulder;
        float angle = side*wave*energy*.62;
        vec2 rotated = vec2(cos(angle)*d.x-sin(angle)*d.y,sin(angle)*d.x+cos(angle)*d.y);
        p += (rotated-d)*arm;
        // 腿部獨立踏步，膝蓋以下的位移逐漸增加。
        float leg = smoothstep(.62,.94,uv.y);
        p.x += side*wave*energy*.045*leg;
        p.y -= max(0.0,side*wave)*energy*.027*leg;
        // 上身側擺與落地的輕微壓縮。
        p.x += wave*energy*.018*(1.0-uv.y);
        p.y += squash*(1.0-uv.y);
        gl_Position = vec4((p.x-.5)/.65,(.5-p.y)/.65,0.0,1.0);
        texcoord = uv;
      }
    `));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec2 texcoord;
      uniform sampler2D image;
      void main(){ gl_FragColor=texture2D(image,texcoord); }
    `));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    uvLoc = gl.getAttribLocation(program,'uv');
    waveLoc = gl.getUniformLocation(program,'wave');
    energyLoc = gl.getUniformLocation(program,'energy');
    squashLoc = gl.getUniformLocation(program,'squash');
    centerLoc = gl.getUniformLocation(program,'center');
    const mesh = [], cols = 20, rows = 28;
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
      const a=x/cols, b=y/rows, c=(x+1)/cols, d=(y+1)/rows;
      mesh.push(a,b,c,b,c,d, a,b,c,d,a,d);
    }
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc,2,gl.FLOAT,false,0,0);
    api.vertices = mesh.length/2;
    gl.clearColor(0,0,0,0);
  }catch(e){ fail('人物動畫初始化失敗：'+e.message); return; }

  sheet.onload = () => {
    try{
      for(const region of regions){
        const [x,y,w,h]=region.box;
        const raw=document.createElement('canvas'); raw.width=w; raw.height=h;
        const rc=raw.getContext('2d',{willReadFrequently:true});
        rc.drawImage(sheet,x,y,w,h,0,0,w,h);
        const pixels=rc.getImageData(0,0,w,h).data;
        let left=w, top=h, right=0, bottom=0;
        for(let py=0;py<h;py++) for(let px=0;px<w;px++){
          if(pixels[(py*w+px)*4+3]<40) continue;
          left=Math.min(left,px); top=Math.min(top,py); right=Math.max(right,px); bottom=Math.max(bottom,py);
        }
        if(right<=left || bottom<=top) throw new Error('人物圖層為空白');
        const cut=document.createElement('canvas'); cut.width=right-left+1; cut.height=bottom-top+1;
        const cc=cut.getContext('2d'); cc.drawImage(raw,left,top,cut.width,cut.height,0,0,cut.width,cut.height);
        const mx=region.mouth[0]-x-left, my=region.mouth[1]-y-top;
        const sample=rc.getImageData(region.mouth[0]-x-13,region.mouth[1]-y-5,1,1).data;
        const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cut);
        actors.push({width:cut.width,height:cut.height,texture,mx,my,skin:`rgb(${sample[0]},${sample[1]},${sample[2]})`});
      }
      api.ready=true;
      if(status) status.textContent='六位人物已就緒 · 按播放開始';
    }catch(e){ fail('人物素材讀取失敗：'+e.message); }
  };
  sheet.onerror=()=>fail('找不到 assets/rise-dancers.png');
  sheet.src='assets/rise-dancers.png';
  surface.addEventListener('webglcontextlost',e=>{e.preventDefault();api.ready=false;fail('人物動畫繪圖環境已中斷，重新整理即可恢復');});

  function draw(ctx,index,x,y,height,state){
    const actor=actors[index];
    if(!api.ready || !actor) return;
    const wave=state.wave||0, energy=state.energy||0, squash=state.squash||0;
    const ratio=height/actor.height, width=actor.width*ratio;
    const targetW=Math.ceil(width*1.3*1.5), targetH=Math.ceil(height*1.3*1.5);
    if(surface.width!==targetW || surface.height!==targetH){surface.width=targetW;surface.height=targetH;}
    gl.viewport(0,0,surface.width,surface.height); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program); gl.bindTexture(gl.TEXTURE_2D,actor.texture);
    gl.uniform1f(waveLoc,wave);gl.uniform1f(energyLoc,energy);gl.uniform1f(squashLoc,squash);
    gl.uniform1f(centerLoc,actor.mx/actor.width);
    gl.drawArrays(gl.TRIANGLES,0,api.vertices);
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(0,0,width*.27,height*.025,0,0,Math.PI*2);ctx.fill();
    ctx.translate(0,-state.hop);ctx.rotate(state.tilt||0);
    ctx.drawImage(surface,-width*.65,-height*1.15,width*1.3,height*1.3);
    // 嘴型隨中頻音量起伏；這是音量驅動的開合效果。
    const mu=actor.mx/actor.width, mv=actor.my/actor.height;
    const mouthX=(mu-.5+wave*energy*.018*(1-mv))*width;
    const mouthY=(-1+mv+squash*(1-mv))*height;
    ctx.save();ctx.translate(mouthX,mouthY);ctx.rotate(.12);
    ctx.fillStyle=actor.skin;ctx.beginPath();ctx.ellipse(0,0,10*ratio,10*ratio,0,0,Math.PI*2);ctx.fill();
    const opening=state.mouth||0;
    if(opening>.09){
      ctx.fillStyle='#803243';ctx.beginPath();ctx.ellipse(0,0,5.4*ratio,(1.2+5.6*opening)*ratio,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f291a6';ctx.beginPath();ctx.ellipse(0,2.2*opening*ratio,3.5*ratio,1.5*opening*ratio,0,0,Math.PI*2);ctx.fill();
    }else{
      ctx.strokeStyle='#934958';ctx.lineWidth=Math.max(.55,1.1*ratio);ctx.beginPath();ctx.moveTo(-4.5*ratio,0);ctx.quadraticCurveTo(0,4*ratio,4.5*ratio,0);ctx.stroke();
    }
    ctx.restore();
    if(state.lead){
      // 小型無線耳麥跟隨頭部位置。
      ctx.strokeStyle='#34404c';ctx.lineWidth=Math.max(.8,1.7*ratio);
      ctx.beginPath();ctx.moveTo(mouthX+14*ratio,mouthY-6*ratio);ctx.quadraticCurveTo(mouthX+14*ratio,mouthY+3*ratio,mouthX+7*ratio,mouthY+2*ratio);ctx.stroke();
    }
    ctx.restore();
  }
})();
