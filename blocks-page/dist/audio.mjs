// A procedural night-city soundtrack. Everything is synthesised with Web Audio; no audio files are fetched.
// Each place has its own layer; layers crossfade as the walker moves between them.
const midi=n=>440*2**((n-69)/12);
const CHORDS=[[57,60,64,67,71],[53,57,60,64,67],[48,52,55,59,62],[55,59,62,65,69]];
const PENTA=[62,64,67,69,71,74,76,79,81];
const MIX={street:{street:1},ramen:{street:.22,ramen:1},gallery:{street:.18,gallery:1},station:{street:.35,station:1},park:{street:.55,gallery:.35},ride:{ride:1},remote:{remote:1}};

export function createSoundtrack(){
  let ctx=null,sizzleTimer=null,master,reverb,noise,layers={},timer=null,step=0,next=0,place='street',on=false;
  const bpm=84,sixteenth=60/bpm/4;
  function impulse(seconds){
    const length=ctx.sampleRate*seconds,buffer=ctx.createBuffer(2,length,ctx.sampleRate);
    for(let c=0;c<2;c++){const data=buffer.getChannelData(c);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length)**2.6;}
    return buffer;
  }
  function layer(name,cutoff=9000,send=.35){
    const gain=ctx.createGain(),filter=ctx.createBiquadFilter(),wet=ctx.createGain();
    filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.value=0;wet.gain.value=send;
    gain.connect(filter);filter.connect(master);filter.connect(wet);wet.connect(reverb);
    layers[name]={gain,filter,level:0};return layers[name];
  }
  function bed(name,type,frequency,q,level){
    const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;
    const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;
    const gain=ctx.createGain();gain.gain.value=level;source.connect(filter);filter.connect(gain);gain.connect(layers[name].gain);source.start();
    return gain;
  }
  function start(){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    reverb=ctx.createConvolver();reverb.buffer=impulse(3.2);const wet=ctx.createGain();wet.gain.value=.5;reverb.connect(wet);wet.connect(master);
    noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    for(const name of ['street','ramen','gallery','station','ride','remote'])layer(name,name==='ramen'?5200:9000,name==='gallery'||name==='remote'?.6:.3);
    bed('street','lowpass',1400,.3,.05);bed('station','bandpass',180,.8,.06);bed('ride','lowpass',220,.6,.22);bed('remote','bandpass',900,.4,.035);
    const sizzle=bed('ramen','highpass',5200,.5,.0);sizzleTimer=setInterval(()=>{if(ctx&&layers.ramen.level>.01)sizzle.gain.setTargetAtTime(.012+Math.random()*.03,ctx.currentTime,.08);},180);
    next=ctx.currentTime+.08;timer=setInterval(schedule,25);setPlace(place,true);
  }
  function envelope(time,attack,hold,release,peak){const g=ctx.createGain();g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(peak,time+attack);g.gain.setValueAtTime(peak,time+attack+hold);g.gain.exponentialRampToValueAtTime(.0001,time+attack+hold+release);return g;}
  function tone(target,time,frequency,{type='sine',attack=.01,hold=.05,release=.3,peak=.1,detune=0,cutoff=0}){
    const osc=ctx.createOscillator(),g=envelope(time,attack,hold,release,peak);osc.type=type;osc.frequency.value=frequency;osc.detune.value=detune;
    let tail=osc;if(cutoff){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=cutoff;osc.connect(f);tail=f;}
    tail.connect(g);g.connect(target);osc.start(time);osc.stop(time+attack+hold+release+.05);
  }
  function hit(target,time,{type='highpass',frequency=7000,decay=.05,peak=.05}){
    const source=ctx.createBufferSource();source.buffer=noise;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=frequency;
    const g=envelope(time,.002,0,decay,peak);source.connect(f);f.connect(g);g.connect(target);source.start(time,Math.random());source.stop(time+decay+.05);
  }
  function kick(target,time,peak=.35){const osc=ctx.createOscillator(),g=envelope(time,.003,.02,.28,peak);osc.frequency.setValueAtTime(120,time);osc.frequency.exponentialRampToValueAtTime(42,time+.2);osc.connect(g);g.connect(target);osc.start(time);osc.stop(time+.4);}
  const live=name=>layers[name].level>.01;
  function schedule(){
    while(next<ctx.currentTime+.12){
      const s=step%16,bar=Math.floor(step/16),chord=CHORDS[bar%4],t=next;
      if(live('street')){
        const L=layers.street.gain;
        if(s===0)for(const n of chord.slice(0,4))for(const d of [-7,7])tone(L,t,midi(n),{type:'sawtooth',attack:1.2,hold:sixteenth*12,release:1.6,peak:.018,detune:d,cutoff:1300});
        if([0,3,6,10].includes(s))tone(L,t,midi(chord[0]-24),{type:'sawtooth',attack:.01,hold:.12,release:.18,peak:.11,cutoff:420});
        if(s%2===0)tone(L,t,midi(chord[(s/2)%5]+12),{type:'square',attack:.005,hold:.03,release:.22,peak:.025,cutoff:2600});
        if(s%4===2)hit(L,t,{peak:.03});if(s===0||s===8)kick(L,t,.3);if(s===4||s===12)hit(L,t,{type:'bandpass',frequency:1800,decay:.14,peak:.06});
      }
      if(live('ramen')){
        const L=layers.ramen.gain,swing=s%2?sixteenth*.18:0;
        if(s===0||s===10)for(const n of chord)tone(L,t,midi(n),{type:'triangle',attack:.01,hold:.1,release:1.4,peak:.03});
        if(s===0||s===8)kick(L,t,.18);if(s===4||s===12)hit(L,t,{type:'bandpass',frequency:2400,decay:.09,peak:.04});
        if(s%2===0)hit(L,t+swing,{peak:.012,decay:.03});
        if(Math.random()<.12)hit(L,t,{type:'highpass',frequency:3000,decay:.01,peak:.02});
      }
      if(live('gallery')){
        const L=layers.gallery.gain;
        if(s===0&&bar%2===0)for(const n of chord)tone(L,t,midi(n-12),{type:'sine',attack:2.4,hold:sixteenth*20,release:3,peak:.025});
        if(s%3===0&&Math.random()<.45)tone(L,t,midi(PENTA[Math.floor(Math.random()*PENTA.length)]+12),{type:'sine',attack:.005,hold:.02,release:2.2,peak:.03});
      }
      if(live('station')){
        const L=layers.station.gain;
        if(s===0&&bar%4===0)[76,72,79,74].forEach((n,k)=>tone(L,t+k*.32,midi(n),{type:'sine',attack:.01,hold:.15,release:.7,peak:.05}));
      }
      if(live('ride')){
        const L=layers.ride.gain;
        if(s===0)for(const n of chord.slice(0,4))tone(L,t,midi(n),{type:'sawtooth',attack:.4,hold:sixteenth*14,release:.8,peak:.016,detune:9,cutoff:2400});
        tone(L,t,midi(chord[s%5]+(s%4<2?12:24)),{type:'square',attack:.004,hold:.02,release:.12,peak:.022,cutoff:3600});
        if(s%4===0)kick(L,t,.32);if(s%2===1)hit(L,t,{peak:.025});if(s%8===4)tone(L,t,midi(chord[0]-24),{type:'sawtooth',hold:.2,release:.2,peak:.1,cutoff:500});
      }
      if(live('remote')){
        const L=layers.remote.gain;
        if(s%2===0&&Math.random()<.5){const n=PENTA[Math.floor(Math.random()*6)];tone(L,t,midi(n),{type:'triangle',attack:.002,hold:.01,release:1.3,peak:.05});tone(L,t,midi(n+12),{type:'sine',attack:.002,hold:.01,release:.6,peak:.015});}
        if(s===0&&bar%2===0)for(const n of [50,57,62])tone(L,t,midi(n),{type:'sine',attack:2,hold:3,release:3,peak:.02});
      }
      next+=sixteenth;step++;
    }
  }
  function setPlace(name,instant=false){
    place=name;if(!ctx)return;const mix=MIX[name]??MIX.street;
    for(const [key,l] of Object.entries(layers)){l.level=mix[key]??0;l.gain.gain.setTargetAtTime(l.level,ctx.currentTime,instant?.01:.9);}
    layers.street.filter.frequency.setTargetAtTime(name==='street'||name==='park'?9000:650,ctx.currentTime,.6);
  }
  return {
    get on(){return on;},
    async toggle(value=!on){
      on=value;if(on&&!ctx)start();if(!ctx)return on;
      if(on){await ctx.resume();master.gain.setTargetAtTime(.55,ctx.currentTime,.4);}
      else{master.gain.setTargetAtTime(0,ctx.currentTime,.2);setTimeout(()=>{if(!on)ctx.suspend();},600);}
      return on;
    },
    setPlace,
    suspend(){if(ctx&&on)ctx.suspend();},resume(){if(ctx&&on)ctx.resume();},
    dispose(){clearInterval(timer);clearInterval(sizzleTimer);ctx?.close();}
  };
}
