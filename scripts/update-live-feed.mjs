import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'live_feed.json');
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const MAX_RESULTS_PER_QUERY = Number(process.env.MAX_RESULTS_PER_QUERY || 4);

const profile = {
  name: '陈欣怡',
  targetYear: '2028',
  degree: '中国海洋大学 管理学院 营销管理研究生；哈尔滨工程大学 工商管理本科，本科保研',
  roles: ['营销', '运营', '产品', '管培', '综合管理', '品牌宣传', '市场运营', '用户运营'],
  stablePaths: ['央国企', '银行', '国考', '省考', '选调', '事业编', '中职教师', '人才引进'],
  mustRegions: ['山东', '天津', '江苏', '浙江'],
  optionalRegions: ['河北', '山西', '陕西', '昆明', '安徽', '河南', '黑龙江', '辽宁'],
  assets: ['985/211 本硕', '中共党员', '快手内容风控运营实习', '用户运营实习', '数据助理实习', '证券实习', '国家级/省级竞赛', '学生干部与文案表达']
};

const searchQueries = [
  { q: '2028届 校园招聘 营销 运营 产品 管培', category: '互联网秋招', region: '全国/重点城市', priority: '高' },
  { q: '2028届 央企 国企 校园招聘 管培 综合管理 市场营销', category: '央国企', region: '全国/重点城市', priority: '高' },
  { q: '银行 校园招聘 管培 营销服务 综合运营 2028届', category: '银行', region: '全国/重点城市', priority: '高' },
  { q: '山东 事业单位 招聘 人才引进 选调 研究生 管理类', category: '山东', region: '山东', priority: '高' },
  { q: '天津 事业单位 招聘 人才引进 选调 研究生 管理类', category: '天津', region: '天津', priority: '高' },
  { q: '江苏 事业单位 招聘 人才引进 选调 研究生 管理类', category: '江苏', region: '江苏', priority: '高' },
  { q: '浙江 事业单位 招聘 人才引进 选调 研究生 管理类', category: '浙江', region: '浙江', priority: '高' },
  { q: '中职教师 招聘 工商管理 市场营销 研究生 事业编', category: '中职教师', region: '全国/重点地区', priority: '中' },
  { q: '高校人才网 人才引进 管理学 工商管理 市场营销 研究生', category: '人才引进/教师', region: '全国/重点地区', priority: '中' }
];

const fallbackSources = [
  { title: '国家公务员局｜国考公告与职位表', category: '公考/选调', region: '全国', priority: '高', source: '国家公务员局', url: 'https://www.scs.gov.cn/', rawSnippet: '国考公告、职位表、报名时间、资格审查、笔试节点。' },
  { title: '山东人事考试信息网｜省考/事业编/教师招聘', category: '山东', region: '山东', priority: '高', source: '山东人事考试信息网', url: 'http://hrss.shandong.gov.cn/rsks/', rawSnippet: '山东为必看地区，优先追踪省考、事业编统考、人才引进、教师招聘。' },
  { title: '天津人事考试｜省考/事业单位/人才引进', category: '天津', region: '天津', priority: '高', source: '天津人事考试', url: 'http://rsks.hrss.tj.gov.cn/', rawSnippet: '天津为必看地区，关注省考、事业单位、人才引进、国央企在津岗位。' },
  { title: '江苏省人事考试网｜事业单位/省考/选调', category: '江苏', region: '江苏', priority: '高', source: '江苏省人事考试网', url: 'http://jshrss.jiangsu.gov.cn/col/col57268/', rawSnippet: '江苏为必看地区，重点看岗位专业目录、学历条件和报名窗口。' },
  { title: '浙江省人事考试院｜公务员/事业单位/人才引进', category: '浙江', region: '浙江', priority: '高', source: '浙江人事考试网', url: 'http://www.zjks.com/', rawSnippet: '浙江为必看地区，适合长期关注人才引进、事业编和综合管理类岗位。' },
  { title: '国聘｜央国企校园招聘与社会招聘', category: '央国企', region: '全国', priority: '高', source: '国聘', url: 'https://www.iguopin.com/', rawSnippet: '重点看管培、综合管理、品牌宣传、市场营销、运营管理、党群人力。' },
  { title: '牛客校招｜互联网营销/运营/产品信息流', category: '互联网秋招', region: '全国/重点城市', priority: '高', source: '牛客', url: 'https://www.nowcoder.com/jobs/school', rawSnippet: '适合追踪互联网校招、运营/产品/市场岗位、笔面经与企业招聘节奏。' },
  { title: '高校人才网｜人才引进/事业单位/教师岗', category: '人才引进/教师', region: '全国/重点地区', priority: '中', source: '高校人才网', url: 'https://www.gaoxiaojob.com/', rawSnippet: '只做公告线索提醒，最终必须回官方公告核验。' }
];

function fmtDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date).replaceAll('/', '-');
}

function hostFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return '未知来源'; }
}

function scoreItem(text, category, region) {
  const hay = `${text} ${category} ${region}`;
  let score = 50;
  const reasons = [];
  for (const r of profile.roles) if (hay.includes(r)) { score += 8; reasons.push(`命中岗位方向：${r}`); }
  for (const p of profile.stablePaths) if (hay.includes(p) || category.includes(p)) { score += 9; reasons.push(`命中稳定路径：${p}`); }
  for (const r of profile.mustRegions) if (hay.includes(r) || region.includes(r)) { score += 10; reasons.push(`命中必看地区：${r}`); }
  for (const r of profile.optionalRegions) if (hay.includes(r) || region.includes(r)) { score += 5; reasons.push(`命中可看地区：${r}`); }
  if (/研究生|硕士|管理|工商管理|市场营销|营销管理|党员|学生干部/.test(hay)) { score += 8; reasons.push('可能匹配你的学历/专业/组织经历'); }
  if (/报名|公告|职位表|校园招聘|校招|人才引进|事业单位/.test(hay)) { score += 7; reasons.push('具有实际报名或公告价值'); }
  return { fit: Math.min(99, score), reasons: [...new Set(reasons)].slice(0, 4) };
}

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) return [];
  const payload = {
    query: query.q,
    search_depth: 'basic',
    include_answer: false,
    include_raw_content: false,
    max_results: MAX_RESULTS_PER_QUERY
  };
  let res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${TAVILY_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  if (res.status === 401 || res.status === 403) {
    // Compatibility fallback for older Tavily examples that pass api_key in body.
    res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, ...payload })
    });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Tavily ${res.status}${detail ? ': ' + detail.slice(0, 120) : ''}`);
  }
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title || query.q,
    category: query.category,
    region: query.region,
    priority: query.priority,
    source: hostFromUrl(r.url),
    url: r.url,
    rawSnippet: r.content || r.snippet || '',
    score: r.score
  }));
}

function normalizeItem(item, mode) {
  const text = `${item.title} ${item.rawSnippet || ''}`;
  const scored = scoreItem(text, item.category, item.region);
  return {
    title: item.title,
    category: item.category,
    region: item.region,
    priority: scored.fit >= 85 ? '高' : item.priority || '中',
    status: mode === 'search' ? '搜索更新' : '监控来源',
    source: item.source || hostFromUrl(item.url),
    url: item.url,
    checkedAt: fmtDate(),
    fit: scored.fit,
    why: scored.reasons.length ? scored.reasons.join('；') : '作为长期信息源保留，需人工核验具体岗位与报名节点。',
    note: item.rawSnippet || item.note || '待核验。'
  };
}

async function main() {
  const collected = [];
  const errors = [];
  if (TAVILY_API_KEY) {
    for (const q of searchQueries) {
      try {
        const rows = await tavilySearch(q);
        collected.push(...rows.map((x) => normalizeItem(x, 'search')));
      } catch (e) {
        errors.push(`${q.q}: ${e.message}`);
      }
    }
  }
  if (!collected.length) collected.push(...fallbackSources.map((x) => normalizeItem(x, 'fallback')));

  const seen = new Set();
  const items = collected
    .filter((x) => x.url && !seen.has(x.url) && seen.add(x.url))
    .sort((a, b) => (b.fit || 0) - (a.fit || 0))
    .slice(0, 40);

  const payload = {
    updatedAt: fmtDate(),
    version: `auto-${Date.now()}`,
    mode: TAVILY_API_KEY ? 'search-api-personalized-feed' : 'fallback-source-monitor',
    profileSummary: '面向陈欣怡 2028 届求职：营销/运营/产品主线，稳定及泛体制优先，必看山东/天津/江苏/浙江。',
    description: TAVILY_API_KEY
      ? '由 GitHub Actions 定时调用搜索接口生成，包含个性化匹配分与推荐理由。'
      : '未配置 TAVILY_API_KEY，目前只能更新固定信息源清单；配置后可生成更实时的信息流。',
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
