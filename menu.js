document.addEventListener('DOMContentLoaded',function(){
  var toggle=document.querySelector('.menu-toggle');
  var links=document.getElementById('primary-nav');
  if(!toggle||!links){return}
  toggle.addEventListener('click',function(){
    var open=links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
});

