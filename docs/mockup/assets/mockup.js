/* oa12-msg — mockup estático. Só troca de perfil, tema e efeitos visuais.
   Nenhuma lógica de produção vive aqui. */
(function () {
  var THEME_KEY = 'oamsg-mockup-theme';
  var ROLE_KEY = 'oamsg-mockup-role';

  function read(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* file:// sem storage */ }
  }

  var theme = read(THEME_KEY, 'dark');  // tema escuro é o padrão
  var role = read(ROLE_KEY, 'superadmin');
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-role', role);

  function applyRole(r) {
    document.documentElement.setAttribute('data-role', r);
    var nodes = document.querySelectorAll('[data-roles]');
    for (var i = 0; i < nodes.length; i++) {
      var allowed = nodes[i].getAttribute('data-roles').split(/\s+/);
      nodes[i].hidden = allowed.indexOf(r) === -1;
    }
    var labels = { superadmin: 'Superadmin', admin: 'Admin', usuario: 'Usuário' };
    var names = { superadmin: 'Claudio Nasajon', admin: 'Marta Ribeiro', usuario: 'Ana Duarte' };
    var mails = { superadmin: 'claudio@…', admin: 'marta@…', usuario: 'ana@…' };
    var who = document.querySelector('.foot .who');
    var rl = document.querySelector('.foot .role');
    if (who) who.textContent = names[r];
    if (rl) rl.textContent = labels[r] + ' · ' + mails[r];
    var nomes = document.querySelectorAll('.nome-usuario');
    for (var k = 0; k < nomes.length; k++) {
      nomes[k].textContent = nomes[k].classList.contains('curto') ? names[r].split(' ')[0] : names[r];
    }
    var papeis = document.querySelectorAll('.papel-usuario');
    for (var m = 0; m < papeis.length; m++) papeis[m].textContent = labels[r];
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b = document.getElementById('theme-toggle');
    if (b) { b.textContent = t === 'dark' ? '☀' : '☾'; b.title = t === 'dark' ? 'Tema claro' : 'Tema escuro'; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyRole(role);
    applyTheme(theme);

    var sel = document.getElementById('role-select');
    if (sel) {
      sel.value = role;
      sel.addEventListener('change', function () {
        role = sel.value; write(ROLE_KEY, role); applyRole(role);
      });
    }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        theme = theme === 'dark' ? 'light' : 'dark'; write(THEME_KEY, theme); applyTheme(theme);
      });
    }

    /* contador dinâmico do editor: 4096 sem imagem, 1024 com imagem */
    var ta = document.getElementById('conteudo');
    if (ta) {
      var temImagem = document.getElementById('tem-imagem');
      var counter = document.getElementById('counter');
      var limiteLbl = document.getElementById('limite-lbl');
      var aviso = document.getElementById('aviso-limite');
      var bar = counter && counter.querySelector('i');
      var n = counter && counter.querySelector('.n');
      function atualiza() {
        var comImagem = temImagem && temImagem.checked;
        var limite = comImagem ? 1024 : 4096;
        var usados = ta.value.length;
        if (n) n.textContent = usados + ' / ' + limite + ' caracteres';
        if (bar) bar.style.width = Math.min(100, (usados / limite) * 100) + '%';
        if (counter) counter.className = 'counter' + (usados > limite ? ' over' : '');
        if (limiteLbl) limiteLbl.textContent = comImagem ? '1024 (legenda com imagem)' : '4096 (texto sem imagem)';
        if (aviso) aviso.hidden = !(comImagem && usados > 1024);
        var box = document.getElementById('img-box');
        if (box) box.hidden = !comImagem;
        var vazio = document.getElementById('img-vazio');
        if (vazio) vazio.hidden = !!comImagem;
      }
      ta.addEventListener('input', atualiza);
      if (temImagem) temImagem.addEventListener('change', atualiza);
      atualiza();
    }

    /* dias da semana clicáveis */
    var dias = document.querySelectorAll('.days span');
    for (var j = 0; j < dias.length; j++) {
      dias[j].addEventListener('click', function () { this.classList.toggle('on'); });
    }
  });
})();
