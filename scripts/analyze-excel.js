const XLSX = require('xlsx');

const wb = XLSX.readFile('public/1.xls');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('📊 Total Rows:', data.length - 1);

const colors = {};
const sizes = {};
const names = {};

data.slice(1).forEach(row => {
  const color = row[9];  // اللون
  const size = row[8];   // المقاس
  const name = row[2];   // اسم الصنف
  
  if (color) colors[color] = (colors[color] || 0) + 1;
  if (size) sizes[size] = (sizes[size] || 0) + 1;
  if (name) names[name] = (names[name] || 0) + 1;
});

console.log('\n🎨 Color Distribution:');
Object.entries(colors)
  .sort((a,b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([k,v]) => console.log(`  ${k}: ${v} products`));

console.log('\n📏 Size Distribution:');
Object.entries(sizes)
  .sort((a,b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([k,v]) => console.log(`  ${k}: ${v} products`));

console.log('\n📦 Products with multiple entries (same name, different colors/sizes):');
const multipleEntries = Object.entries(names)
  .filter(([k,v]) => v > 1)
  .sort((a,b) => b[1] - a[1])
  .slice(0, 20);

console.log(`  Total: ${multipleEntries.length} products with variations`);
multipleEntries.forEach(([k,v]) => console.log(`  "${k}": ${v} variations`));

// Check specific examples
console.log('\n🔍 Sample Analysis - Looking for actual color variations:');
const sampleProducts = data.slice(1, 50);
const groupedSamples = {};

sampleProducts.forEach(row => {
  const name = row[2];
  const color = row[9];
  
  if (name && color && color !== 'متنوع') {
    if (!groupedSamples[name]) groupedSamples[name] = [];
    groupedSamples[name].push(color);
  }
});

Object.entries(groupedSamples)
  .filter(([name, colors]) => colors.length > 1)
  .slice(0, 5)
  .forEach(([name, colors]) => {
    console.log(`  "${name}": [${[...new Set(colors)].join(', ')}]`);
  });
