document.addEventListener('DOMContentLoaded',function(){
  var toggle=document.querySelector('.menu-toggle');
  var links=document.getElementById('primary-nav');
  if(!toggle||!links){return}

  function setVisibility(){
    var isMobile = window.matchMedia('(max-width: 700px)').matches;
    toggle.hidden = !isMobile; // show button only on mobile
    if(!isMobile){
      // Ensure desktop layout is clean
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
      links.style.display = '';
    }
    else {
      // Hide links on mobile until opened (JS fallback if CSS not applied)
      links.style.display = 'none';
    }
  }
  setVisibility();
  window.addEventListener('resize', setVisibility);

  toggle.addEventListener('click',function(){
    var open=links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open){
      links.style.display = 'flex';
      links.style.flexDirection = 'column';
      links.style.width = '100%';
      links.style.paddingTop = '8px';
      links.style.gap = '8px';
    }else{
      links.style.display = 'none';
    }
  });
});
