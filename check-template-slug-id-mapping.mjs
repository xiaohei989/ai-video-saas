import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查模板slug与ID的映射关系...')

// 获取所有模板的slug和ID
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)
  .order('slug')

console.log(`📋 找到 ${templates.length} 个模板:`)
templates.forEach(template => {
  const name = typeof template.name === 'object' ? 
    template.name?.zh || template.name?.en || template.slug : template.name
  console.log(`  slug: ${template.slug} -> ID: ${template.id} (${name})`)
})

// 检查SQL脚本中提到的slug是否都存在
const sqlSlugs = [
  'windowsill-animal-interview',
  'miniature-animals-surprise', 
  'animal-skateboarding-street',
  'blueprint-to-product',
  'asmr-surreal-toast-spread',
  'newborn-baby-interview-comedy',
  'cctv-animal-rider-surveillance',
  'country-historical-evolution',
  'surveillance-animal-encounter',
  'skydiving-adventure',
  'crystal-fruit-biting-asmr',
  'baby-adult-anxiety-comedy',
  'tiny-pet-fingertip',
  'bigfoot-survival-vlog',
  'energy-object-cutting-asmr',
  'glass-cutting-asmr',
  'living-book-storms',
  'olympic-animal-diving-broadcast',
  'natural-phenomenon-cutting-asmr',
  'yeti-mountain-life-vlog',
  'city-landmarks-book',
  'time-travel-ancient-livestream',
  'selfie-vlog-animals',
  'ocean-selfie-surprise',
  'surveillance-animal-trampoline',
  'baby-profession-interview',
  'magic-pen-3d-bloom',
  'fireplace-cozy-selfie',
  'art-coffee-machine',
  'magical-creature-summon',
  'finger-touch-activation'
]

console.log('\n🔍 检查SQL脚本中的slug是否存在:')
const templateSlugs = new Set(templates.map(t => t.slug))

for (const slug of sqlSlugs) {
  const exists = templateSlugs.has(slug)
  console.log(`  ${slug}: ${exists ? '✅ 存在' : '❌ 不存在'}`)
  
  if (exists) {
    const template = templates.find(t => t.slug === slug)
    console.log(`    -> ID: ${template.id}`)
  }
}

console.log('\n📊 总结:')
console.log(`SQL脚本提到的模板数: ${sqlSlugs.length}`)
console.log(`数据库中的模板数: ${templates.length}`)
console.log(`匹配的模板数: ${sqlSlugs.filter(slug => templateSlugs.has(slug)).length}`)