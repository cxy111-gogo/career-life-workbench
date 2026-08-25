import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'live_feed.json');

const sources = [
  {
    title: '国家公务员局｜国考公告与职位表',
    category: '公考/选调',
    region: '全国',
    priority: '高',
    source: '国家公务员局',
    url: 'https://www.scs.gov.cn/',
    note: '重点看公告时间、职位表、报名节点、专业限制、政治面貌、基层经历要求。'
  },
  {
    title: '山东人事考试信息网｜省考/事业编/教师招聘',
    category: '山东',
    region: '山东',
    priority: '高',
    source: '山东人事考试信息网',
    url: 'http://hrss.shandong.gov.cn/rsks/',
    note: '山东为必看地区，优先追踪省考、事业编统考、人才引进、教师招聘。'
  },
  {
    title: '天津市人事考试网上报名公共服务平台',
    category: '天津',
    region: '天津',
    priority: '高',
    source: '天津人事考试',
    url: 'http://rsks.hrss.tj.gov.cn/',
    note: '天津为必看地区，关注省考、事业单位、人才引进、国央企在津岗位。'
  },
  {
    title: '江苏省人事考试网｜事业单位/省考/选调',
    category: '江苏',
    region: '江苏',
    priority: '高',
    source: '江苏省人事考试网',
    url: 'http://jshrss.jiangsu.gov.cn/col/col57268/',
    note: '江苏为必看地区，重点看岗位专业目录、学历条件和报名窗口。'
  },
  {
    title: '浙江省人事考试院｜公务员/事业单位/人才引进',
    category: '浙江',
    region: '浙江',
    priority: '高',
    source: '浙江人事考试网',
    url: 'http://www.zjks.com/',
    note: '浙江为必看地区，适合长期关注人才引进、事业编和综合管理类岗位。'
  },
  {
    title: '国聘｜央国企校园招聘与社会招聘',
    category: '央国企',
    region: '全国',
    priority: '高',
    source: '国聘',
    url: 'https://www.iguopin.com/',
    note: '重点看管培、综合管理、品牌宣传、市场营销、运营管理、党群人力。'
  },
  {
    title: '银行校招官网｜管培/营销服务/综合运营',
    category: '银行',
    region: '全国/重点城市',
    priority: '高',
    source: '银行招聘聚合入口',
    url: 'https://campus.chinahr.com/',
    note: '银行方向优先看管培、营销服务、综合运营、客户经理、金融科技非技术岗。'
  },
  {
    title: '牛客校招｜互联网营销/运营/产品信息流',
    category: '互联网秋招',
    region: '全国/重点城市',
    priority: '高',
    source: '牛客',
    url: 'https://www.nowcoder.com/jobs/school',
    note: '适合追踪互联网校招、运营/产品/市场岗位、笔面经与企业招聘节奏。'
  },
  {
    title: '高校人才网｜人才引进/事业单位/教师岗',
    category: '人才引进/教师',
    region: '全国/重点地区',
    priority: '中',
    source: '高校人才网',
    url: 'https://www.gaoxiaojob.com/',
    note: '只做公告线索提醒，最终必须回官方公告核验，不直接依赖聚合站投递。'
  }
];

function fmtDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replaceAll('/', '-');
}

async function probe(source) {
  const checkedAt = fmtDate();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(source.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'career-life-workbench/1.0' }
    });
    const html = await res.text().catch(() => '');
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    clearTimeout(timer);
    return {
      ...source,
      status: res.ok ? '已连通' : `待核验 ${res.status}`,
      checkedAt,
      signal: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 80) : '已完成连通性检查'
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      ...source,
      status: '待人工核验',
      checkedAt,
      signal: '自动访问失败，可能是网站反爬/网络限制；仍保留为人工关注来源。'
    };
  }
}

const items = [];
for (const source of sources) {
  items.push(await probe(source));
}

const payload = {
  updatedAt: fmtDate(),
  version: `auto-${Date.now()}`,
  mode: 'github-actions-scheduled-feed',
  description: '由 GitHub Actions 定时更新。当前为信息源连通性与重点来源滚动监控，不等同于自动投递或完整岗位爬虫。',
  items
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Updated ${OUT} with ${items.length} sources at ${payload.updatedAt}`);
