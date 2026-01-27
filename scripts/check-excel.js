const XLSX = require('xlsx');

const wb = XLSX.readFile('e:/spare2app/pro/vendor-dashboard/public/1.xls');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('📊 Sheet Name:', wb.SheetNames[0]);
console.log('\n📋 Headers:', data[0]);
console.log('\n📦 Total Rows:', data.length - 1);
console.log('\n🔍 First 5 rows:\n');

data.slice(1, 6).forEach((row, i) => {
  console.log(`Row ${i+1}:`);
  row.forEach((cell, j) => {
    if (cell !== undefined && cell !== '') {
      console.log(`  [${data[0][j]}]: ${cell}`);
    }
  });
  console.log('---');
});
