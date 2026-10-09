const test = require('node:test');
const assert = require('node:assert/strict');
process.env.TZ = 'Asia/Shanghai';
const { parseTimestamp, formatLocalTime } = require('../js/time.js');

test('登录和所有角色页包含逐字相同的版权行', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const page of ['login', 'employee', 'reviewer', 'developer']) {
    const html = fs.readFileSync(path.join(__dirname, `../${page}.html`), 'utf8');
    assert.equal(html.split('© 2026 知了 · 保留所有权利</footer>').length - 1, 1);
    assert.match(html, /<footer class="[^"]*copyright-line/);
    assert.match(html, /style\.css\?v=copyright-20261009/);
  }
});

test('管理后台robots拒绝全部爬虫且无域名或Sitemap', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  const robots = read('robots.txt');
  assert.equal(robots.replace(/\r/g, '').trim(), 'User-agent: *\nDisallow: /');
  assert.doesNotMatch(robots, /sitemap|https?:|www\.|[\w-]+\.[a-z]{2,}/i);
  assert.match(read('Dockerfile'), /COPY --chown=nginx:nginx robots\.txt \/usr\/share\/nginx\/html\/robots\.txt/);
  assert.match(read('nginx.conf'), /location \/ \{\s*try_files \$uri \$uri\/ =404;/);
});

test('Asia/Shanghai: 带Z和旧UTC-naive都显示10:46', () => {
  assert.equal(new Date('2026-09-30T02:46:13Z').getTimezoneOffset(), -480);
  const legacy = '2026-09-30T02:46:13';
  const tagged = legacy + 'Z';
  assert.equal(formatLocalTime(legacy), formatLocalTime(tagged));
  assert.match(formatLocalTime(tagged), /10:46/);
  assert.equal(formatLocalTime(tagged), formatLocalTime('2026-09-30T10:46:13+08:00'));
  assert.equal(formatLocalTime(tagged), formatLocalTime('2026-09-30 02:46:13'));
  console.log(tagged + ' / ' + legacy + ' -> ' + formatLocalTime(tagged));
});

test('跨日、空值、非法值和显式偏移都按同一口径处理', () => {
  assert.match(formatLocalTime('2026-09-30T20:46:13Z'), /10[\/\-]01.*04:46/);
  assert.equal(parseTimestamp('2026-09-30T02:46:13').toISOString(), '2026-09-30T02:46:13.000Z');
  assert.equal(formatLocalTime('invalid'), '-');
  assert.equal(formatLocalTime(null), '-');
  assert.equal(formatLocalTime('', {}, '时间未知'), '时间未知');
  assert.equal(parseTimestamp('2026-09-30'), null);
});

const fs = require('node:fs');
const path = require('node:path');
test('所有工作台用统一入口，不直接显示原始时间', () => {
  for (const page of ['developer', 'employee', 'reviewer']) {
    const html = fs.readFileSync(path.join(__dirname, '../' + page + '.html'), 'utf8');
    assert.ok(html.indexOf('./js/time.js?') < html.indexOf('./js/' + page + '.js?'));
    const js = fs.readFileSync(path.join(__dirname, '../js/' + page + '.js'), 'utf8');
    assert.doesNotMatch(js, /new Date\(value\)|function formatTimestamp/);
    assert.doesNotMatch(js, /escapeHtml\((?:item|data|record)\.(?:\w+_at|timestamp|stats_since)/);
    assert.match(js, /ZhitianTime\.formatLocalTime\(/);
  }
});
