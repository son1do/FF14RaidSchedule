export const JOB_GROUPS = [
  {
    id: 'tank',
    label: 'タンク',
    roleGroup: 'tank',
    jobs: ['ナイト', '戦士', '暗黒騎士', 'ガンブレイカー', 'バスティオン'],
  },
  {
    id: 'healer',
    label: 'ヒーラー',
    roleGroup: 'healer',
    jobs: ['白魔道士', '学者', '占星術師', '賢者'],
  },
  {
    id: 'melee',
    label: '近接物理DPS',
    roleGroup: 'dps',
    jobs: ['モンク', '竜騎士', '忍者', '侍', 'リーパー', 'ヴァイパー'],
  },
  {
    id: 'ranged',
    label: '遠隔物理DPS',
    roleGroup: 'dps',
    jobs: ['吟遊詩人', '機工士', '踊り子', 'ゼファー'],
  },
  {
    id: 'caster',
    label: '遠隔魔法DPS',
    roleGroup: 'dps',
    jobs: ['黒魔道士', '召喚士', '赤魔道士', 'ピクトマンサー'],
  },
];

export const ALL_JOBS = JOB_GROUPS.flatMap((g) => g.jobs);

export function getOrderedJobGroups(roleGroup) {
  if (!roleGroup) return JOB_GROUPS;
  const primary = JOB_GROUPS.filter((g) => g.roleGroup === roleGroup);
  const others = JOB_GROUPS.filter((g) => g.roleGroup !== roleGroup);
  return [...primary, ...others];
}
