'use strict';

const { redact } = require('./redact-prompt.cjs');

// ponytail: lexical signals also match quoted examples; confirmation resolves false positives.
const RULES = [
  ['EXFIL-01', 'data_exfiltration', 0.9, '可能向外部传输数据', /send\s+(all|every|entire)\s+.+?\s+to\s+|export\s+.*\s+to\s+(external|outside|third[ _-]?party)|upload\s+.*(credentials|secrets|keys)|curl\s+.*(?:\s-d\s|--data\b)|(?:上传|发送|导出).{0,40}(?:外部|第三方|公网|密钥|凭证)/iu],
  ['PRIV-01', 'privilege_escalation', 0.9, '可能提升权限或放宽访问控制', /\b(?:sudo|runas\s+\/user|chmod\s+(?:-\w+\s+)*777)\b|as\s+root|admin\s+access|add\s+.*(?:sudoers|administrators)|(?:提升|授予|添加).{0,15}(?:管理员|root|超级用户)权限/iu],
  ['DESTROY-01', 'system_destruction', 0.95, '可能递归删除文件或丢弃未保存的改动', /\brm\s+(?:-[a-z]+\s+)*(?:--recursive\b|-[a-z]*r[a-z]*\b)|\bdel\s+\/[sq]\b|\bformat\s+[a-z]:|\bRemove-Item\b[^\n]*-Recurse\b|\bgit\s+(?:reset\s+--hard|clean\s+-[a-z]*f)|wipe\s+(all|entire|every)|(?:删除|清空|销毁).{0,15}(?:所有|全部|整个|目录|数据库|生产数据)/iu],
  ['DB-01', 'system_destruction', 0.95, '可能删除数据库或批量删除表数据', /\b(?:drop\s+(?:database|table|schema)|truncate\s+table|delete\s+from)\b/iu],
  ['INJECT-01', 'prompt_injection', 0.9, '可能要求覆盖既有指令', /ignore\s+(?:previous|above|all)\s+(?:instructions?|rules?|prompts?)|you\s+are\s+now\s+(?:a|an)\s+(?:assistant|ai|bot|system|expert|language\s+model)\b|^\s*system\s*:\s*you\s+are|(?:忽略|无视|绕过).{0,15}(?:指令|规则|限制|安全策略)/imu],
];

function scan(prompt) {
  const threats = RULES.flatMap(([rule_id, category, severity, description, pattern]) => {
    const match = prompt.match(pattern);
    return match ? [{ rule_id, category, severity, description, evidence: redact(match[0]).slice(0, 2000) }] : [];
  });
  const sanitized = redact(prompt);
  if (sanitized !== prompt && /\[REDACTED(?:_TOKEN|_PRIVATE_KEY)?\]/u.test(sanitized)) {
    threats.push({ rule_id: 'SECRET-01', category: 'credential_exposure', severity: 0.95,
      description: '包含疑似凭证，需要核对暴露范围', evidence: '[REDACTED]' });
  }
  return threats;
}

module.exports = { scan };
