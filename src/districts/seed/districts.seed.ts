// id города будет зависеть от того, как они созданы в cities.bulk
// допустим:
// 1 = Астана
// 2 = Алматы

export const districtsSeed = [
  // Астана
  { name: 'Есильский район', slug: 'esil', cityId: 1 },
  { name: 'Алматы район', slug: 'almaty-rayon', cityId: 1 },
  { name: 'Сарыарка район', slug: 'saryarka', cityId: 1 },

  // Алматы
  { name: 'Алмалинский', slug: 'almalinsky', cityId: 2 },
  { name: 'Бостандыкский', slug: 'bostandyk', cityId: 2 },
  { name: 'Медеуский', slug: 'medeu', cityId: 2 },
];
