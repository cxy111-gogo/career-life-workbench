import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'live_feed.json');
const SOURCE_REGISTRY = path.join(ROOT, 'data', 'source_registry.json');
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const MAX_RESULTS_PER_QUERY = Number(process.env.MAX_RESULTS_PER_QUERY || 5);

const profile = {
  name: '陈欣怡',
  targetYear: '2028',
  roles: ['营销', '运营', '产品', '管培', '综合管理', '品牌宣传', '市场运营', '用户运营', '党群', '人力'],
  stablePaths: ['央国企', '银行', '国考', '省考', '选调', '事业编', '中职教师', '高职教师', '大专教师', '人才引进'],
  mustRegions: ['山东', '天津', '江苏', '浙江'],
  optionalRegions: ['河北', '山西', '陕西', '昆明', '安徽', '河南', '黑龙江', '辽宁'],
  assets: ['985/211 本硕', '中共党员', '快手内容风控运营实习', '用户运营实习', '数据助理实习', '证券实习', '国家级/省级竞赛', '学生干部与文案表达']
};

const baseQueries = [
  { q: '中央机关及其直属机构 考试录用公务员 公告 职位表 官方', category: '国考', region: '全国', priority: '高', sourceTier: '官方源' },
  { q: '2027 2028 国考 公告 职位表 报名时间 官方', category: '国考', region: '全国', priority: '高', sourceTier: '官方源' },
  { q: '山东 省考 事业单位 选调 教师招聘 人才引进 官方公告', category: '省考/事业编', region: '山东', priority: '高', sourceTier: '官方源' },
  { q: '天津 省考 事业单位 选调 教师招聘 人才引进 官方公告', category: '省考/事业编', region: '天津', priority: '高', sourceTier: '官方源' },
  { q: '江苏 省考 事业单位 选调 教师招聘 人才引进 官方公告', category: '省考/事业编', region: '江苏', priority: '高', sourceTier: '官方源' },
  { q: '浙江 省考 事业单位 选调 教师招聘 人才引进 官方公告', category: '省考/事业编', region: '浙江', priority: '高', sourceTier: '官方源' },
  { q: '中等职业学校 职业技术学院 教师招聘 市场营销 工商管理 官方公告', category: '中专/大专教师', region: '全国/重点地区', priority: '高', sourceTier: '官方源' },
  { q: '央企 校园招聘 管培 综合管理 市场营销 品牌宣传 官方招聘', category: '央国企', region: '全国/重点城市', priority: '高', sourceTier: '企业官网' },
  { q: '国企 校园招聘 管培 综合管理 市场营销 山东 天津 江苏 浙江', category: '央国企', region: '重点地区', priority: '高', sourceTier: '企业官网' },
  { q: '银行 校园招聘 管培 营销服务 综合运营 2028届 官方', category: '银行', region: '全国/重点城市', priority: '高', sourceTier: '企业官网' },
  { q: '2028届 互联网大厂 校园招聘 产品 运营 市场 官方', category: '互联网大厂', region: '全国/重点城市', priority: '高', sourceTier: '企业官网' },
  { q: '宝洁 联合利华 欧莱雅 海尔 海信 管培 市场营销 校园招聘 官方', category: '其他大企业', region: '全国/重点城市', priority: '中', sourceTier: '企业官网' }
];

const prioritySOEs = [
  '中国移动', '中国电信', '中国联通', '国家电网', '南方电网', '中国邮政', '中粮集团', '华润集团', '招商局集团', '中国旅游集团', '中国商飞', '中国中车', '中国建筑', '中国交建', '中国铁建', '中国中铁', '中国医药', '中国保利', '国投', '中国诚通', '中国国新'
];

const fallbackSources = [
  { title: '中央机关及其直属机构考试录用公务员专题｜国考公告与职位表', category: '国考', region: '全国', priority: '高', sourceTier: '官方源', source: '国家公务员局专题站', url: 'http://bm.scs.gov.cn/kl2026', rawSnippet: '国考公告、职位表、报名时间、资格审查、笔试节点。最终以专题站为准。' },
  { title: '山东人事考试信息网｜省考/事业编/教师招聘', category: '省考/事业编', region: '山东', priority: '高', sourceTier: '官方源', source: '山东人事考试信息网', url: 'http://hrss.shandong.gov.cn/rsks/', rawSnippet: '山东为必看地区，优先追踪省考、事业编统考、人才引进、教师招聘。' },
  { title: '天津人事考试｜省考/事业单位/人才引进', category: '省考/事业编', region: '天津', priority: '高', sourceTier: '官方源', source: '天津人事考试', url: 'http://rsks.hrss.tj.gov.cn/', rawSnippet: '天津为必看地区，关注省考、事业单位、人才引进、国央企在津岗位。' },
  { title: '江苏省人事考试网｜事业单位/省考/选调', category: '省考/事业编', region: '江苏', priority: '高', sourceTier: '官方源', source: '江苏省人事考试网', url: 'http://jshrss.jiangsu.gov.cn/col/col57268/', rawSnippet: '江苏为必看地区，重点看岗位专业目录、学历条件和报名窗口。' },
  { title: '浙江省人事考试院｜公务员/事业单位/人才引进', category: '省考/事业编', region: '浙江', priority: '高', sourceTier: '官方源', source: '浙江人事考试网', url: 'http://www.zjks.com/', rawSnippet: '浙江为必看地区，适合长期关注人才引进、事业编和综合管理类岗位。' },
  { title: '国务院国资委央企名录｜央企名单基准', category: '央国企', region: '全国', priority: '高', sourceTier: '官方源', source: '国务院国资委', url: 'http://wap.sasac.gov.cn/n2588045/n27271785/n27271792/c14159097/content.html', rawSnippet: '央企名单以国务院国资委名录为准；后续按企业官网/招聘入口分批追踪。' },
  { title: '国聘｜央国企校园招聘与社会招聘', category: '央国企', region: '全国', priority: '高', sourceTier: '聚合线索', source: '国聘', url: 'https://www.iguopin.com/', rawSnippet: '重点看管培、综合管理、品牌宣传、市场营销、运营管理、党群人力。聚合站只作线索。' },
  { title: '牛客校招｜互联网营销/运营/产品信息流', category: '互联网大厂', region: '全国/重点城市', priority: '高', sourceTier: '聚合线索', source: '牛客', url: 'https://www.nowcoder.com/jobs/school', rawSnippet: '适合追踪互联网校招、运营/产品/市场岗位、笔面经与企业招聘节奏。最终以公司官网为准。' },
  { title: '高校人才网｜中职/高职/人才引进线索', category: '中专/大专教师', region: '全国/重点地区', priority: '中', sourceTier: '聚合线索', source: '高校人才网', url: 'https://www.gaoxiaojob.com/', rawSnippet: '只做公告线索提醒，最终必须回学校/教育局/人社局官方公告核验。' }
];

function fmtDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date).replaceAll('/', '-');
}

function hostFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return '未知来源'; }
}

function cleanText(text, fallback = '请点开原文核验具体公告/岗位内容。') {
  const raw = String(text || '').replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!raw) return fallback;
  const sample = raw.slice(0, 500);
  const zh = (sample.match(/[\u4e00-\u9fa5]/g) || []).length;
  const ascii = (sample.match(/[a-zA-Z0-9，。；：、,.!?%/\-()（）【】\[\]《》\s]/g) || []).length;
  const weird = sample.length - zh - ascii;
  if ((sample.length && weird / sample.length > 0.22) || /�|Ã|Â|Ð|Ñ|º|¼|µ|ç|Ã/.test(sample)) return fallback;
  return raw.slice(0, 240);
}

function cleanTitle(title, fallback) {
  return cleanText(title, fallback).slice(0, 86);
}

function inferTier(url, given = '') {
  if (given) return given;
  const host = hostFromUrl(url);
  if (/gov\.cn|scs\.gov\.cn|cpta\.com\.cn|sasac\.gov\.cn|hrss|rst|rsks|zjks|hebpta|apta|hnrsks|lnrsks|sxrsks|hljrsks/.test(host)) return '官方源';
  if (/campus|career|zhaopin|job|hr|iguopin|nowcoder|gaoxiaojob/.test(host)) return '企业/聚合源';
  return '待核验来源';
}

function scoreItem(text, category, region, tier) {
  const hay = `${text} ${category} ${region} ${tier}`;
  let score = 48;
  const reasons = [];
  if (tier === '官方源') { score += 14; reasons.push('官方来源优先'); }
  if (tier === '企业官网') { score += 10; reasons.push('企业官方招聘入口'); }
  if (tier === '聚合线索') { score -= 4; reasons.push('聚合线索需回官方核验'); }
  for (const r of profile.roles) if (hay.includes(r)) { score += 8; reasons.push(`命中岗位方向：${r}`); }
  for (const p of profile.stablePaths) if (hay.includes(p) || category.includes(p)) { score += 9; reasons.push(`命中稳定路径：${p}`); }
  for (const r of profile.mustRegions) if (hay.includes(r) || region.includes(r)) { score += 11; reasons.push(`命中必看地区：${r}`); }
  for (const r of profile.optionalRegions) if (hay.includes(r) || region.includes(r)) { score += 5; reasons.push(`命中可看地区：${r}`); }
  if (/研究生|硕士|管理|工商管理|市场营销|营销管理|党员|学生干部|应届|校园招聘|校招/.test(hay)) { score += 8; reasons.push('可能匹配你的学历/专业/组织经历'); }
  if (/报名|公告|职位表|校园招聘|校招|人才引进|事业单位|选调|考试录用/.test(hay)) { score += 8; reasons.push('具有实际报名或公告价值'); }
  return { fit: Math.min(99, Math.max(35, score)), reasons: [...new Set(reasons)].slice(0, 5) };
}

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) return [];
  const payload = { query: query.q, search_depth: 'basic', include_answer: false, include_raw_content: false, max_results: MAX_RESULTS_PER_QUERY };
  let res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify(payload)
  });
  if (res.status === 401 || res.status === 403) {
    res = await fetch('https://api.tavily.com/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: TAVILY_API_KEY, ...payload })
    });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Tavily ${res.status}${detail ? ': ' + detail.slice(0, 120) : ''}`);
  }
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: cleanTitle(r.title || query.q, query.q),
    category: query.category,
    region: query.region,
    priority: query.priority,
    sourceTier: query.sourceTier,
    source: hostFromUrl(r.url),
    url: r.url,
    rawSnippet: cleanText(r.content || r.snippet || '', '搜索命中了相关页面，但摘要编码异常；请点开原文核验。'),
    score: r.score
  }));
}

function buildQueriesFromRegistry(registry) {
  const queries = [...baseQueries];
  for (const src of [...(registry.officialExamSources || []), ...(registry.teacherSources || []), ...(registry.enterpriseSources || [])]) {
    if (src.query) queries.push({ q: src.query, category: src.category || '来源库', region: src.region || '全国', priority: '高', sourceTier: src.category?.includes('聚合') ? '聚合线索' : '官方源' });
  }
  for (const name of prioritySOEs.slice(0, 12)) {
    queries.push({ q: `${name} 校园招聘 管培 综合管理 市场营销 品牌宣传 官方招聘`, category: '央国企', region: '全国/重点城市', priority: '高', sourceTier: '企业官网' });
  }
  const seen = new Set();
  return queries.filter(q => !seen.has(q.q) && seen.add(q.q));
}

function normalizeItem(item, mode) {
  const safeTitle = cleanTitle(item.title, `${item.category}｜相关信息源`);
  const safeNote = cleanText(item.rawSnippet || item.note, '搜索命中了相关页面，但摘要不可读；请点开原文核验公告/岗位内容。');
  const tier = inferTier(item.url, item.sourceTier);
  const text = `${safeTitle} ${safeNote}`;
  const scored = scoreItem(text, item.category, item.region, tier);
  return {
    title: safeTitle,
    category: item.category,
    region: item.region,
    priority: scored.fit >= 82 ? '高' : item.priority || '中',
    status: mode === 'search' ? '搜索更新' : '监控来源',
    sourceTier: tier,
    source: item.source || hostFromUrl(item.url),
    url: item.url,
    checkedAt: fmtDate(),
    fit: scored.fit,
    why: scored.reasons.length ? scored.reasons.join('；') : '作为长期信息源保留，需人工核验具体岗位与报名节点。',
    note: safeNote,
    action: tier === '聚合线索' ? '先收藏，必须回官方公告核验后再行动。' : '点开原文，核验报名时间、岗位表、专业限制和应届要求。'
  };
}

async function loadRegistry() {
  try { return JSON.parse(await fs.readFile(SOURCE_REGISTRY, 'utf8')); } catch { return {}; }
}

async function main() {
  const registry = await loadRegistry();
  const collected = [];
  const errors = [];
  const queries = buildQueriesFromRegistry(registry);
  if (TAVILY_API_KEY) {
    for (const q of queries) {
      try {
        const rows = await tavilySearch(q);
        collected.push(...rows.map((x) => normalizeItem(x, 'search')));
      } catch (e) {
        errors.push(`${q.q}: ${e.message}`);
      }
    }
  }
  collected.push(...fallbackSources.map((x) => normalizeItem(x, TAVILY_API_KEY ? 'fallback-plus' : 'fallback')));

  const seen = new Set();
  const items = collected
    .filter((x) => x.url && !seen.has(x.url) && seen.add(x.url))
    .sort((a, b) => (b.fit || 0) - (a.fit || 0))
    .slice(0, 70);

  const payload = {
    updatedAt: fmtDate(),
    version: `auto-${Date.now()}`,
    mode: TAVILY_API_KEY ? 'search-api-personalized-feed-v3' : 'fallback-source-monitor-v3',
    profileSummary: '面向陈欣怡 2028 届求职：营销/运营/产品主线，稳定及泛体制优先；重点追踪国考、省考、选调、事业编、中专/大专教师、央国企、银行、互联网大厂及其他大企业。',
    description: '由 GitHub Actions 定时调用搜索接口生成。官方源优先，企业官网次之，聚合站只作线索；所有报名/投递以官方公告原文为准。',
    stats: {
      total: items.length,
      official: items.filter(x => x.sourceTier === '官方源').length,
      enterprise: items.filter(x => x.sourceTier === '企业官网').length,
      aggregate: items.filter(x => x.sourceTier === '聚合线索').length,
      highFit: items.filter(x => (x.fit || 0) >= 85).length
    },
    sourceRegistry: {
      officialExamSources: (registry.officialExamSources || []).length,
      teacherSources: (registry.teacherSources || []).length,
      enterpriseSources: (registry.enterpriseSources || []).length,
      priorityCentralSOEs: (registry.priorityCentralSOEs || []).length
    },
    errors,
    items
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Updated ${OUT}: ${items.length} items, mode=${payload.mode}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
